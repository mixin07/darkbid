use serde::{Deserialize, Serialize};
use thiserror::Error;

/// The Groth16 proof bundle sent by the bidder inside `RevealBidRequest`.
///
/// All byte arrays are hex-encoded strings so they travel cleanly over JSON.
/// Layout follows the canonical compressed representation used by `ark-groth16`:
///   - `proof_a`  : G1 affine point  (33 bytes compressed → 66 hex chars)
///   - `proof_b`  : G2 affine point  (65 bytes compressed → 130 hex chars)
///   - `proof_c`  : G1 affine point  (33 bytes compressed → 66 hex chars)
///   - `public_inputs`: ordered public signals [reservePrice, commitHash]
///     as big-endian 32-byte field elements (64 hex chars each).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkProof {
    /// Compressed G1 point A (hex).
    pub proof_a: String,
    /// Compressed G2 point B (hex).
    pub proof_b: String,
    /// Compressed G1 point C (hex).
    pub proof_c: String,
    /// Public signals: [reservePrice_field, commitHash_field] (hex).
    pub public_inputs: Vec<String>,
}

/// Errors that can occur during ZK proof verification.
#[derive(Debug, Error)]
pub enum ZkVerifyError {
    #[error("hex decode error: {0}")]
    HexDecode(#[from] hex::FromHexError),

    #[error("proof deserialization error: {0}")]
    Deserialize(String),

    #[error("verification key not found at path: {0}")]
    VkeyNotFound(String),

    #[error("verification key parse error: {0}")]
    VkeyParse(String),

    #[error("wrong number of public inputs: expected {expected}, got {got}")]
    InputCountMismatch { expected: usize, got: usize },

    #[error("ZK proof is invalid")]
    ProofInvalid,
}
