use axum::{extract::{Path, State}, Json};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    db::queries,
    domain::auction::AuctionStatus,
    errors::{AppError, AppResult},
    middlewares::auth::AuthUser,
    state::AppState,
};

#[derive(Deserialize)]
pub struct CreateAuctionRequest {
    pub title: String,
    pub reserve_price: i64,
    pub commit_duration_seconds: Option<i64>,
    pub reveal_duration_seconds: Option<i64>,
}

#[derive(Serialize)]
pub struct AuctionSummary {
    pub id: Uuid,
    pub title: String,
    pub status: AuctionStatus,
    pub commit_end_at: DateTime<Utc>,
    pub reveal_end_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct AuctionDetail {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub title: String,
    pub reserve_price: i64,
    pub status: AuctionStatus,
    pub commit_end_at: DateTime<Utc>,
    pub reveal_end_at: DateTime<Utc>,
    pub winner_bid_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct WinnerInfo {
    pub bid_id: Uuid,
    pub bidder_id: Uuid,
    pub bidder_wallet: String,
    pub amount: i64,
}

#[derive(Serialize)]
pub struct AuctionResult {
    pub auction_id: Uuid,
    pub title: String,
    pub reserve_price: i64,
    pub status: AuctionStatus,
    pub total_bids: usize,
    pub revealed_bids: usize,
    pub valid_bids: usize,
    pub winner: Option<WinnerInfo>,
}

pub async fn get_result(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> AppResult<Json<AuctionResult>> {
    // ── 1. Load the auction ────────────────────────────────────────────────
    let mut row = queries::get_auction(&state.db, id)
        .await?
        .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    // ── 2. If ended but no winner yet, compute it now (fallback) ───────────
    if row.status == AuctionStatus::Ended && row.winner_bid_id.is_none() {
        row = queries::set_winner(&state.db, id).await?;
    }

    // ── 3. Gather bid statistics ───────────────────────────────────────────
    let bids = queries::get_bids_for_auction(&state.db, id).await?;
    let total_bids = bids.len();
    let revealed_bids = bids.iter().filter(|b| b.revealed_at.is_some()).count();
    let valid_bids = bids
        .iter()
        .filter(|b| b.is_valid && b.reveal_amount.is_some())
        .count();

    // ── 4. Build winner details (if any) ───────────────────────────────────
    let winner = if let Some(winner_bid_id) = row.winner_bid_id {
        let winning_bid = bids
            .iter()
            .find(|b| b.id == winner_bid_id);

        if let Some(bid) = winning_bid {
            let wallet = queries::get_user_wallet(&state.db, bid.bidder_id)
                .await?
                .unwrap_or_else(|| "unknown".into());

            Some(WinnerInfo {
                bid_id: bid.id,
                bidder_id: bid.bidder_id,
                bidder_wallet: wallet,
                amount: bid.reveal_amount.unwrap_or(0),
            })
        } else {
            None
        }
    } else {
        None
    };

    Ok(Json(AuctionResult {
        auction_id: row.id,
        title: row.title,
        reserve_price: row.reserve_price,
        status: row.status,
        total_bids,
        revealed_bids,
        valid_bids,
        winner,
    }))
}

pub async fn create_auction(
    user: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateAuctionRequest>,
) -> AppResult<Json<AuctionDetail>> {
    // ── Input validation ───────────────────────────────────────────────────
    let title = req.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::Validation("title must not be empty".into()));
    }
    if req.reserve_price < 0 {
        return Err(AppError::Validation("reserve_price must be non-negative".into()));
    }

    // ── Compute phase end times ────────────────────────────────────────────
    // commit_end_at  = now + commit_duration
    // reveal_end_at  = commit_end_at + reveal_duration
    let now = Utc::now();
    let commit_secs = req
        .commit_duration_seconds
        .unwrap_or(state.config.commit_duration_seconds as i64);
    let reveal_secs = req
        .reveal_duration_seconds
        .unwrap_or(state.config.reveal_duration_seconds as i64);

    if commit_secs < 10 {
        return Err(AppError::Validation("commit_duration must be at least 10 seconds".into()));
    }
    if reveal_secs < 10 {
        return Err(AppError::Validation("reveal_duration must be at least 10 seconds".into()));
    }

    let commit_end_at = now + Duration::seconds(commit_secs);
    let reveal_end_at = commit_end_at + Duration::seconds(reveal_secs);

    let auction_id = Uuid::new_v4();
    let row = queries::create_auction(
        &state.db,
        auction_id,
        user.user_id,
        &title,
        req.reserve_price,
        commit_end_at,
        reveal_end_at,
    )
    .await?;

    Ok(Json(AuctionDetail {
        id: row.id,
        creator_id: row.creator_id,
        title: row.title,
        reserve_price: row.reserve_price,
        status: row.status,
        commit_end_at: row.commit_end_at,
        reveal_end_at: row.reveal_end_at,
        winner_bid_id: row.winner_bid_id,
        created_at: row.created_at,
    }))
}

pub async fn list_auctions(State(state): State<AppState>) -> AppResult<Json<Vec<AuctionSummary>>> {
    let rows = queries::list_auctions(&state.db).await?;

    let summaries = rows
        .into_iter()
        .map(|a| AuctionSummary {
            id: a.id,
            title: a.title,
            status: a.status,
            commit_end_at: a.commit_end_at,
            reveal_end_at: a.reveal_end_at,
        })
        .collect();

    Ok(Json(summaries))
}

pub async fn get_auction(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> AppResult<Json<AuctionDetail>> {
    let row = queries::get_auction(&state.db, id)
        .await?
        .ok_or_else(|| AppError::Validation("auction not found".into()))?;

    Ok(Json(AuctionDetail {
        id: row.id,
        creator_id: row.creator_id,
        title: row.title,
        reserve_price: row.reserve_price,
        status: row.status,
        commit_end_at: row.commit_end_at,
        reveal_end_at: row.reveal_end_at,
        winner_bid_id: row.winner_bid_id,
        created_at: row.created_at,
    }))
}
