-- Migration: 0002_zk.sql
-- Adds ZK proof storage columns to the bids table.
--
-- After a bidder reveals their bid, the backend stores:
--   zk_proof         – the raw Groth16 proof bundle (JSON text)
--   zk_public_inputs – the ordered public signals submitted with the proof (JSON text)
--   zk_verified      – whether the proof passed on-chain / server-side verification
--
-- NULL values indicate that the bid has not been revealed yet, or that the
-- bidder chose not to submit a ZK proof (backward-compatible).

ALTER TABLE bids
    ADD COLUMN zk_proof         TEXT,
    ADD COLUMN zk_public_inputs TEXT,
    ADD COLUMN zk_verified      BOOLEAN NOT NULL DEFAULT FALSE;

-- Index speeds up queries like "fetch all verified bids for an auction".
CREATE INDEX idx_bids_zk_verified ON bids (auction_id, zk_verified);

COMMENT ON COLUMN bids.zk_proof IS
    'Groth16 proof bundle: JSON object with fields proof_a, proof_b, proof_c (hex-compressed ark-serialize)';
COMMENT ON COLUMN bids.zk_public_inputs IS
    'Ordered public signals sent with the proof: [reservePrice_hex, commitHash_hex]';
COMMENT ON COLUMN bids.zk_verified IS
    'TRUE when the backend (or on-chain program) verified the Groth16 proof successfully';
