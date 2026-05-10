use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    db::queries,
    errors::{AppError, AppResult},
    middlewares::auth::AuthUser,
    solana::verify::{
        verify_commit_hash_in_logs, verify_program_in_tx, verify_signer, verify_tx_signature,
    },
    state::AppState,
    zk::{types::ZkProof, verify_bid_proof},
};

// ─────────────────────────────────────────────────────────────────────────────
// Commit Phase
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CommitBidRequest {
    pub auction_id: Uuid,
    /// SHA-256 / Poseidon hash of (bid_amount || nonce), computed client-side.
    pub commit_hash: String,
    /// Solana transaction signature that anchored the commitment on-chain.
    pub commit_tx_sig: String,
}

#[derive(Serialize)]
pub struct CommitBidResponse {
    pub bid_id: Uuid,
}

pub async fn commit_bid(
    user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CommitBidRequest>,
) -> AppResult<Json<CommitBidResponse>> {
    // ── 1. Resolve the bidder's wallet address for signer verification ─────
    let wallet = queries::get_user_wallet(&state.db, user.user_id)
        .await?
        .ok_or_else(|| AppError::Validation("bidder not found".into()))?;

    // ── 2. Verify the Solana commit transaction on-chain ───────────────────
    let tx_info = verify_tx_signature(
        &state.http,
        &state.config.solana_rpc_url,
        &req.commit_tx_sig,
    )
    .await?;

    // 2a. Confirm the expected program was invoked
    verify_program_in_tx(&tx_info, &state.config.solana_program_id)?;

    // 2b. Confirm the bidder's wallet was a signer
    verify_signer(&tx_info, &wallet)?;

    // 2b. Soft-check: commit_hash appears in the program logs
    verify_commit_hash_in_logs(&tx_info, &req.commit_hash)?;

    // ── 3. Store the commitment (transactional: validates ACTIVE status +
    //       prevents duplicate bids) ────────────────────────────────────────
    let bid_id = Uuid::new_v4();
    let bid = queries::store_commit(
        &state.db,
        bid_id,
        req.auction_id,
        user.user_id,
        &req.commit_hash,
        &req.commit_tx_sig,
    )
    .await?;

    Ok(Json(CommitBidResponse { bid_id: bid.id }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal Phase
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RevealBidRequest {
    pub bid_id: Uuid,
    pub auction_id: Uuid,
    /// The plaintext bid amount (in lamports or token units).
    pub reveal_amount: i64,
    /// The random nonce used at commit time (for hash preimage check).
    pub nonce: String,
    /// Solana transaction signature that anchored the reveal on-chain.
    pub reveal_tx_sig: String,
    /// Groth16 ZK proof bundle produced by the `BidRangeProof` circuit.
    /// If omitted the server performs only the hash-preimage check.
    pub zk_proof: Option<ZkProof>,
}

#[derive(Serialize)]
pub struct RevealBidResponse {
    pub bid_id: Uuid,
    /// Whether the bid meets the reserve price and is therefore eligible to win.
    pub is_valid: bool,
    /// Whether the ZK proof was submitted and passed verification.
    pub zk_verified: bool,
}

pub async fn reveal_bid(
    user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<RevealBidRequest>,
) -> AppResult<Json<RevealBidResponse>> {
    // ── 1. Load the committed bid ──────────────────────────────────────────
    let bid_row = queries::get_bid(&state.db, req.bid_id)
        .await?
        .ok_or_else(|| AppError::Validation("bid not found".into()))?;

    if bid_row.bidder_id != user.user_id {
        return Err(AppError::Validation("bidder mismatch".into()));
    }

    if bid_row.auction_id != req.auction_id {
        return Err(AppError::Validation("auction mismatch".into()));
    }

    // ── 2. Fetch auction for status check + reserve price ──────────────────
    let auction_row = queries::get_auction(&state.db, req.auction_id)
        .await?
        .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    // Early status check (the DB transaction in store_reveal also enforces
    // this, but we can fail fast and save a Solana RPC round-trip)
    if auction_row.status != crate::domain::auction::AuctionStatus::Reveal {
        return Err(AppError::Validation(format!(
            "auction is {:?} — reveals are only accepted during the REVEAL phase",
            auction_row.status
        )));
    }

    // ── 3. Verify the Solana reveal transaction on-chain ───────────────────
    let wallet = queries::get_user_wallet(&state.db, user.user_id)
        .await?
        .ok_or_else(|| AppError::Validation("bidder not found".into()))?;

    let tx_info = verify_tx_signature(
        &state.http,
        &state.config.solana_rpc_url,
        &req.reveal_tx_sig,
    )
    .await?;

    verify_program_in_tx(&tx_info, &state.config.solana_program_id)?;
    verify_signer(&tx_info, &wallet)?;

    // ── 4. Recompute hash with hashing.rs and validate preimage ────────────
    //    commit_hash = SHA-256(amount : nonce : bidder_id)
    if !crate::utils::hashing::verify_commit(
        &bid_row.commit_hash,
        req.reveal_amount,
        &req.nonce,
        &bid_row.bidder_id,
    ) {
        return Err(AppError::Validation(
            "commit hash mismatch – reveal amount or nonce is wrong".into(),
        ));
    }

    // ── 5. Validate amount ≥ reserve price → marks bid valid/invalid ───────
    let is_valid = req.reveal_amount >= auction_row.reserve_price;

    // ── 6. ZK proof verification (Groth16 / BidRangeProof circuit) ─────────
    let zk_verified = if let Some(ref proof) = req.zk_proof {
        verify_bid_proof(proof)?;
        true
    } else {
        false
    };

    // Serialise the proof bundle for storage
    let zk_proof_json = req
        .zk_proof
        .as_ref()
        .map(|p| serde_json::to_string(p).unwrap_or_default());
    let zk_inputs_json = req
        .zk_proof
        .as_ref()
        .map(|p| serde_json::to_string(&p.public_inputs).unwrap_or_default());

    // ── 7. Persist the reveal (transactional – validates REVEAL status,
    //       ownership, prevents double-reveal, stores is_valid) ─────────────
    let updated_bid = queries::store_reveal(
        &state.db,
        req.bid_id,
        req.auction_id,
        user.user_id,
        req.reveal_amount,
        &req.reveal_tx_sig,
        is_valid,
        zk_proof_json.as_deref(),
        zk_inputs_json.as_deref(),
        zk_verified,
    )
    .await?;

    Ok(Json(RevealBidResponse {
        bid_id: updated_bid.id,
        is_valid: updated_bid.is_valid,
        zk_verified: updated_bid.zk_verified,
    }))
}
