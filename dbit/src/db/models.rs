use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::auction::AuctionStatus;

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DbUser {
    pub id: Uuid,
    pub wallet_address: String,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DbAuction {
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

#[derive(Debug, Clone, FromRow, Serialize)]
pub struct DbBid {
    pub id: Uuid,
    pub auction_id: Uuid,
    pub bidder_id: Uuid,
    pub commit_hash: String,
    pub commit_tx_sig: String,
    pub reveal_amount: Option<i64>,
    pub reveal_tx_sig: Option<String>,
    pub revealed_at: Option<DateTime<Utc>>,
    pub is_valid: bool,
    pub commit_at: DateTime<Utc>,
    // ZK proof columns (migration 0002_zk.sql)
    pub zk_proof: Option<String>,
    pub zk_public_inputs: Option<String>,
    pub zk_verified: bool,
}

