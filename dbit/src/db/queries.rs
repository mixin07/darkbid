//! Database query layer.
//!
//! Every public function in this module maps to a single logical DB operation.
//! `store_commit` and `store_reveal` use explicit transactions to guard against
//! race conditions (double-commit, reveal-on-ended-auction, etc.).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    db::models::{DbAuction, DbBid},
    domain::auction::AuctionStatus,
    errors::{AppError, AppResult},
};

// ─────────────────────────────────────────────────────────────────────────────
// Auction lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/// Transition auctions whose time windows have elapsed:
///
/// * `ACTIVE  → REVEAL` when `commit_end_at <= now`
/// * `REVEAL  → ENDED`  when `reveal_end_at <= now`
///   ↳ also picks the winner automatically using the deterministic tie-break.
///
/// Called every 15 s by the background scheduler.
pub async fn advance_auction_statuses(
    db: &PgPool,
    now: DateTime<Utc>,
) -> AppResult<()> {
    // ── 1. ACTIVE → REVEAL ─────────────────────────────────────────────────
    sqlx::query!(
        r#"
        UPDATE auctions
        SET    status = 'REVEAL'
        WHERE  status = 'ACTIVE'
          AND  commit_end_at <= $1
        "#,
        now,
    )
    .execute(db)
    .await?;

    // ── 2. REVEAL → ENDED (collect IDs for winner selection) ───────────────
    let ended_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        UPDATE auctions
        SET    status = 'ENDED'
        WHERE  status = 'REVEAL'
          AND  reveal_end_at <= $1
        RETURNING id
        "#,
        now,
    )
    .fetch_all(db)
    .await?;

    // ── 3. Auto-select winners for all newly-ended auctions ────────────────
    //
    // Deterministic tie-break (matches domain::auction::pick_winner):
    //   1. Highest reveal_amount wins
    //   2. On tie → earliest commit_at wins
    //   3. On tie → lowest bidder_id (UUID comparison) wins
    for auction_id in ended_ids {
        // Use a single SQL statement that finds the winner and writes it
        // in one shot — no round-trip needed.
        let result = sqlx::query!(
            r#"
            UPDATE auctions
            SET    winner_bid_id = (
                SELECT id
                FROM   bids
                WHERE  auction_id    = $1
                  AND  is_valid      = true
                  AND  reveal_amount IS NOT NULL
                ORDER BY reveal_amount DESC,
                         commit_at    ASC,
                         bidder_id    ASC
                LIMIT 1
            )
            WHERE id = $1
              AND winner_bid_id IS NULL
            "#,
            auction_id,
        )
        .execute(db)
        .await;

        if let Err(e) = result {
            tracing::warn!(
                auction_id = %auction_id,
                error = ?e,
                "failed to pick winner for ended auction"
            );
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Auction CRUD
// ─────────────────────────────────────────────────────────────────────────────

/// Insert a new auction and return the full row.
pub async fn create_auction(
    db: &PgPool,
    id: Uuid,
    creator_id: Uuid,
    title: &str,
    reserve_price: i64,
    commit_end_at: DateTime<Utc>,
    reveal_end_at: DateTime<Utc>,
) -> AppResult<DbAuction> {
    let row = sqlx::query_as!(
        DbAuction,
        r#"
        INSERT INTO auctions
            (id, creator_id, title, reserve_price, commit_end_at, reveal_end_at)
        VALUES
            ($1, $2, $3, $4, $5, $6)
        RETURNING
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        "#,
        id,
        creator_id,
        title,
        reserve_price,
        commit_end_at,
        reveal_end_at,
    )
    .fetch_one(db)
    .await?;

    Ok(row)
}

/// Return all auctions, most recent first.
pub async fn list_auctions(db: &PgPool) -> AppResult<Vec<DbAuction>> {
    let rows = sqlx::query_as!(
        DbAuction,
        r#"
        SELECT
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        FROM auctions
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(db)
    .await?;

    Ok(rows)
}

/// Fetch a single auction by id, or `None` if it doesn't exist.
pub async fn get_auction(db: &PgPool, auction_id: Uuid) -> AppResult<Option<DbAuction>> {
    let row = sqlx::query_as!(
        DbAuction,
        r#"
        SELECT
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        FROM auctions
        WHERE id = $1
        "#,
        auction_id,
    )
    .fetch_optional(db)
    .await?;

    Ok(row)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bid – commit phase (transactional)
// ─────────────────────────────────────────────────────────────────────────────

/// Store a new bid commitment inside a transaction.
///
/// The transaction ensures:
/// 1. The auction exists and is in `ACTIVE` status.
/// 2. The bidder hasn't already committed to this auction (one bid per user).
/// 3. The bid row is inserted atomically.
///
/// Returns the newly inserted bid row.
pub async fn store_commit(
    db: &PgPool,
    bid_id: Uuid,
    auction_id: Uuid,
    bidder_id: Uuid,
    commit_hash: &str,
    commit_tx_sig: &str,
) -> AppResult<DbBid> {
    let mut tx = db.begin().await?;

    // 1. Lock the auction row and verify status
    let auction = sqlx::query_as!(
        DbAuction,
        r#"
        SELECT
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        FROM auctions
        WHERE id = $1
        FOR UPDATE
        "#,
        auction_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    if auction.status != AuctionStatus::Active {
        return Err(AppError::Validation(format!(
            "auction is {:?} — commits are only accepted during the ACTIVE phase",
            auction.status
        )));
    }

    // 2. Check for duplicate commit (one bid per bidder per auction)
    let existing = sqlx::query_scalar!(
        r#"
        SELECT id FROM bids
        WHERE auction_id = $1 AND bidder_id = $2
        "#,
        auction_id,
        bidder_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    if existing.is_some() {
        return Err(AppError::Validation(
            "you have already committed a bid to this auction".into(),
        ));
    }

    // 3. Insert the bid
    let bid = sqlx::query_as!(
        DbBid,
        r#"
        INSERT INTO bids
            (id, auction_id, bidder_id, commit_hash, commit_tx_sig)
        VALUES
            ($1, $2, $3, $4, $5)
        RETURNING
            id,
            auction_id,
            bidder_id,
            commit_hash,
            commit_tx_sig,
            reveal_amount,
            reveal_tx_sig,
            revealed_at,
            is_valid,
            commit_at,
            zk_proof,
            zk_public_inputs,
            zk_verified
        "#,
        bid_id,
        auction_id,
        bidder_id,
        commit_hash,
        commit_tx_sig,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(bid)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bid – reveal phase (transactional)
// ─────────────────────────────────────────────────────────────────────────────

/// Persist a bid reveal inside a transaction.
///
/// The transaction ensures:
/// 1. The auction is in `REVEAL` status.
/// 2. The bid exists and belongs to the bidder.
/// 3. The bid hasn't already been revealed (idempotency guard).
/// 4. The reveal data, `is_valid` flag, and optional ZK proof are written atomically.
///
/// `is_valid` is determined by the caller (amount ≥ reserve). Only valid bids
/// are eligible for winner selection.
///
/// Returns the updated bid row.
pub async fn store_reveal(
    db: &PgPool,
    bid_id: Uuid,
    auction_id: Uuid,
    bidder_id: Uuid,
    reveal_amount: i64,
    reveal_tx_sig: &str,
    is_valid: bool,
    zk_proof_json: Option<&str>,
    zk_inputs_json: Option<&str>,
    zk_verified: bool,
) -> AppResult<DbBid> {
    let mut tx = db.begin().await?;

    // 1. Lock the auction and verify it's in REVEAL phase
    let auction = sqlx::query_as!(
        DbAuction,
        r#"
        SELECT
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        FROM auctions
        WHERE id = $1
        FOR UPDATE
        "#,
        auction_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    if auction.status != AuctionStatus::Reveal {
        return Err(AppError::Validation(format!(
            "auction is {:?} — reveals are only accepted during the REVEAL phase",
            auction.status
        )));
    }

    // 2. Lock the bid row, verify ownership and that it hasn't been revealed
    let existing_bid = sqlx::query_as!(
        DbBid,
        r#"
        SELECT
            id,
            auction_id,
            bidder_id,
            commit_hash,
            commit_tx_sig,
            reveal_amount,
            reveal_tx_sig,
            revealed_at,
            is_valid,
            commit_at,
            zk_proof,
            zk_public_inputs,
            zk_verified
        FROM bids
        WHERE id = $1 AND auction_id = $2
        FOR UPDATE
        "#,
        bid_id,
        auction_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Validation("bid not found".into()))?;

    if existing_bid.bidder_id != bidder_id {
        return Err(AppError::Validation("bidder mismatch".into()));
    }

    if existing_bid.revealed_at.is_some() {
        return Err(AppError::Validation("bid has already been revealed".into()));
    }

    // 3. Persist the reveal + is_valid flag
    let bid = sqlx::query_as!(
        DbBid,
        r#"
        UPDATE bids
        SET    reveal_amount     = $1,
               reveal_tx_sig    = $2,
               revealed_at      = NOW(),
               is_valid         = $3,
               zk_proof         = $4,
               zk_public_inputs = $5,
               zk_verified      = $6
        WHERE  id = $7
        RETURNING
            id,
            auction_id,
            bidder_id,
            commit_hash,
            commit_tx_sig,
            reveal_amount,
            reveal_tx_sig,
            revealed_at,
            is_valid,
            commit_at,
            zk_proof,
            zk_public_inputs,
            zk_verified
        "#,
        reveal_amount,
        reveal_tx_sig,
        is_valid,
        zk_proof_json,
        zk_inputs_json,
        zk_verified,
        bid_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(bid)
}

// ─────────────────────────────────────────────────────────────────────────────
// Winner selection
// ─────────────────────────────────────────────────────────────────────────────

/// Set the winning bid on an auction.
///
/// Uses a transaction to:
/// 1. Verify the auction is `ENDED`.
/// 2. Find the highest valid revealed bid (tie-break: earliest commit).
/// 3. Write `winner_bid_id` on the auction row.
///
/// Returns the updated auction.
pub async fn set_winner(db: &PgPool, auction_id: Uuid) -> AppResult<DbAuction> {
    let mut tx = db.begin().await?;

    // 1. Lock the auction
    let auction = sqlx::query_as!(
        DbAuction,
        r#"
        SELECT
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        FROM auctions
        WHERE id = $1
        FOR UPDATE
        "#,
        auction_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    if auction.status != AuctionStatus::Ended {
        return Err(AppError::Validation(format!(
            "auction is {:?} — winner can only be set after the auction has ENDED",
            auction.status
        )));
    }

    if auction.winner_bid_id.is_some() {
        return Err(AppError::Validation("winner has already been set".into()));
    }

    // 2. Pick the highest valid revealed bid.
    //    Deterministic tie-break (matches domain::auction::pick_winner):
    //      1. Highest reveal_amount
    //      2. Earliest commit_at
    //      3. Lowest bidder_id (UUID)
    let winner_bid_id = sqlx::query_scalar!(
        r#"
        SELECT id
        FROM   bids
        WHERE  auction_id    = $1
          AND  is_valid       = true
          AND  reveal_amount IS NOT NULL
        ORDER BY reveal_amount DESC,
                 commit_at    ASC,
                 bidder_id    ASC
        LIMIT 1
        "#,
        auction_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    // 3. Update the auction (winner may be None if no valid bids were revealed)
    let updated = sqlx::query_as!(
        DbAuction,
        r#"
        UPDATE auctions
        SET    winner_bid_id = $1
        WHERE  id = $2
        RETURNING
            id,
            creator_id,
            title,
            reserve_price,
            status AS "status: AuctionStatus",
            commit_end_at,
            reveal_end_at,
            winner_bid_id,
            created_at
        "#,
        winner_bid_id,
        auction_id,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(updated)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bid queries (non-transactional helpers)
// ─────────────────────────────────────────────────────────────────────────────

/// Fetch all bids for an auction.
pub async fn get_bids_for_auction(db: &PgPool, auction_id: Uuid) -> AppResult<Vec<DbBid>> {
    let rows = sqlx::query_as!(
        DbBid,
        r#"
        SELECT
            id,
            auction_id,
            bidder_id,
            commit_hash,
            commit_tx_sig,
            reveal_amount,
            reveal_tx_sig,
            revealed_at,
            is_valid,
            commit_at,
            zk_proof,
            zk_public_inputs,
            zk_verified
        FROM bids
        WHERE auction_id = $1
        ORDER BY commit_at ASC
        "#,
        auction_id,
    )
    .fetch_all(db)
    .await?;

    Ok(rows)
}

/// Fetch a single bid by id.
pub async fn get_bid(db: &PgPool, bid_id: Uuid) -> AppResult<Option<DbBid>> {
    let row = sqlx::query_as!(
        DbBid,
        r#"
        SELECT
            id,
            auction_id,
            bidder_id,
            commit_hash,
            commit_tx_sig,
            reveal_amount,
            reveal_tx_sig,
            revealed_at,
            is_valid,
            commit_at,
            zk_proof,
            zk_public_inputs,
            zk_verified
        FROM bids
        WHERE id = $1
        "#,
        bid_id,
    )
    .fetch_optional(db)
    .await?;

    Ok(row)
}

/// Fetch a user's wallet address by their id.
pub async fn get_user_wallet(db: &PgPool, user_id: Uuid) -> AppResult<Option<String>> {
    let row = sqlx::query_scalar!(
        r#"
        SELECT wallet_address FROM users WHERE id = $1
        "#,
        user_id,
    )
    .fetch_optional(db)
    .await?;

    Ok(row)
}
