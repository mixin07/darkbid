use sha2::{Digest, Sha256};
use uuid::Uuid;

pub fn commit_hash(amount: i64, nonce: &str, bidder_id: &Uuid) -> String {
    let mut hasher = Sha256::new();
    hasher.update(amount.to_string());
    hasher.update(":" );
    hasher.update(nonce);
    hasher.update(":" );
    hasher.update(bidder_id.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn verify_commit(expected_hash: &str, amount: i64, nonce: &str, bidder_id: &Uuid) -> bool {
    let actual = commit_hash(amount, nonce, bidder_id);
    actual == expected_hash
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_deterministic() {
        let bidder = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let h1 = commit_hash(1000, "my_nonce", &bidder);
        let h2 = commit_hash(1000, "my_nonce", &bidder);
        assert_eq!(h1, h2, "same inputs must produce the same hash");
    }

    #[test]
    fn hash_is_hex_64_chars() {
        let bidder = Uuid::new_v4();
        let h = commit_hash(42, "test", &bidder);
        assert_eq!(h.len(), 64, "SHA-256 hex digest is 64 characters");
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn different_amounts_produce_different_hashes() {
        let bidder = Uuid::new_v4();
        assert_ne!(
            commit_hash(100, "nonce", &bidder),
            commit_hash(200, "nonce", &bidder)
        );
    }

    #[test]
    fn different_nonces_produce_different_hashes() {
        let bidder = Uuid::new_v4();
        assert_ne!(
            commit_hash(100, "nonce_a", &bidder),
            commit_hash(100, "nonce_b", &bidder)
        );
    }

    #[test]
    fn different_bidders_produce_different_hashes() {
        let b1 = Uuid::new_v4();
        let b2 = Uuid::new_v4();
        assert_ne!(
            commit_hash(100, "nonce", &b1),
            commit_hash(100, "nonce", &b2)
        );
    }

    #[test]
    fn verify_correct_preimage() {
        let bidder = Uuid::new_v4();
        let h = commit_hash(500, "secret_nonce", &bidder);
        assert!(verify_commit(&h, 500, "secret_nonce", &bidder));
    }

    #[test]
    fn verify_rejects_wrong_amount() {
        let bidder = Uuid::new_v4();
        let h = commit_hash(500, "secret_nonce", &bidder);
        assert!(!verify_commit(&h, 501, "secret_nonce", &bidder));
    }

    #[test]
    fn verify_rejects_wrong_nonce() {
        let bidder = Uuid::new_v4();
        let h = commit_hash(500, "secret_nonce", &bidder);
        assert!(!verify_commit(&h, 500, "wrong_nonce", &bidder));
    }

    #[test]
    fn verify_rejects_wrong_bidder() {
        let b1 = Uuid::new_v4();
        let b2 = Uuid::new_v4();
        let h = commit_hash(500, "nonce", &b1);
        assert!(!verify_commit(&h, 500, "nonce", &b2));
    }

    #[test]
    fn zero_and_negative_amounts() {
        let bidder = Uuid::new_v4();
        let h0 = commit_hash(0, "n", &bidder);
        assert!(verify_commit(&h0, 0, "n", &bidder));

        let hn = commit_hash(-100, "n", &bidder);
        assert!(verify_commit(&hn, -100, "n", &bidder));
        assert!(!verify_commit(&hn, 100, "n", &bidder));
    }

    #[test]
    fn empty_nonce() {
        let bidder = Uuid::new_v4();
        let h = commit_hash(42, "", &bidder);
        assert!(verify_commit(&h, 42, "", &bidder));
    }
}

