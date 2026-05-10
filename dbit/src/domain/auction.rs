use std::cmp::Ordering;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use uuid::Uuid;

use crate::domain::bid::Bid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "auction_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AuctionStatus {
    Active,
    Reveal,
    Ended,
}

#[derive(Debug, Clone)]
pub struct Auction {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub title: String,
    pub reserve_price: i64,
    pub status: AuctionStatus,
    pub commit_end_at: DateTime<Utc>,
    pub reveal_end_at: DateTime<Utc>,
    pub winner_bid_id: Option<Uuid>,
}

pub fn pick_winner(bids: &[Bid]) -> Option<Bid> {
    bids.iter()
        .filter(|bid| bid.is_valid && bid.reveal_amount.is_some())
        .cloned()
        .max_by(|a, b| {
            let a_amount = a.reveal_amount.unwrap_or_default();
            let b_amount = b.reveal_amount.unwrap_or_default();

            match a_amount.cmp(&b_amount) {
                Ordering::Equal => match b.commit_at.cmp(&a.commit_at) {
                    Ordering::Equal => b.bidder_id.cmp(&a.bidder_id),
                    other => other,
                },
                other => other,
            }
        })
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    /// Helper to create a test bid with sensible defaults.
    fn make_bid(amount: i64, valid: bool, commit_offset_secs: i64) -> Bid {
        Bid {
            id: Uuid::new_v4(),
            auction_id: Uuid::new_v4(),
            bidder_id: Uuid::new_v4(),
            commit_hash: "deadbeef".into(),
            commit_at: Utc::now() + Duration::seconds(commit_offset_secs),
            reveal_amount: Some(amount),
            is_valid: valid,
            zk_proof: None,
            zk_public_inputs: None,
            zk_verified: false,
        }
    }

    #[test]
    fn highest_bid_wins() {
        let bids = vec![
            make_bid(100, true, 0),
            make_bid(500, true, 1),
            make_bid(200, true, 2),
        ];
        let winner = pick_winner(&bids).unwrap();
        assert_eq!(winner.reveal_amount, Some(500));
    }

    #[test]
    fn tie_break_by_earliest_commit() {
        let auction_id = Uuid::new_v4();
        let now = Utc::now();

        let mut b1 = make_bid(300, true, 0);
        b1.auction_id = auction_id;
        b1.commit_at = now + Duration::seconds(10); // later

        let mut b2 = make_bid(300, true, 0);
        b2.auction_id = auction_id;
        b2.commit_at = now + Duration::seconds(5); // earlier → should win

        let winner = pick_winner(&[b1, b2.clone()]).unwrap();
        assert_eq!(winner.id, b2.id, "earlier commit should win on tie");
    }

    #[test]
    fn tie_break_by_bidder_id_when_same_time() {
        let auction_id = Uuid::new_v4();
        let same_time = Utc::now();

        // Create two bids with same amount and same commit_at
        let mut b1 = make_bid(300, true, 0);
        b1.auction_id = auction_id;
        b1.commit_at = same_time;
        b1.bidder_id = Uuid::parse_str("ffffffff-ffff-ffff-ffff-ffffffffffff").unwrap();

        let mut b2 = make_bid(300, true, 0);
        b2.auction_id = auction_id;
        b2.commit_at = same_time;
        b2.bidder_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();

        // Lower UUID should win (b.bidder_id.cmp(&a.bidder_id) with max_by
        // means higher bidder_id is "greater", so b2 with lower UUID wins)
        let winner = pick_winner(&[b1, b2.clone()]).unwrap();
        assert_eq!(winner.id, b2.id, "lower bidder_id should win on full tie");
    }

    #[test]
    fn invalid_bids_excluded() {
        let bids = vec![
            make_bid(1000, false, 0), // invalid (below reserve)
            make_bid(200, true, 1),   // valid
        ];
        let winner = pick_winner(&bids).unwrap();
        assert_eq!(
            winner.reveal_amount,
            Some(200),
            "invalid bid should not win even if higher"
        );
    }

    #[test]
    fn unrevealed_bids_excluded() {
        let mut unrevealed = make_bid(1000, true, 0);
        unrevealed.reveal_amount = None; // not yet revealed

        let revealed = make_bid(100, true, 1);
        let winner = pick_winner(&[unrevealed, revealed]).unwrap();
        assert_eq!(winner.reveal_amount, Some(100));
    }

    #[test]
    fn no_valid_bids_returns_none() {
        let bids = vec![
            make_bid(500, false, 0),
            make_bid(300, false, 1),
        ];
        assert!(pick_winner(&bids).is_none());
    }

    #[test]
    fn empty_bids_returns_none() {
        assert!(pick_winner(&[]).is_none());
    }

    #[test]
    fn single_valid_bid_wins() {
        let bids = vec![make_bid(42, true, 0)];
        let winner = pick_winner(&bids).unwrap();
        assert_eq!(winner.reveal_amount, Some(42));
    }
}

