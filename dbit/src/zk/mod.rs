pub mod proof;
pub mod types;

pub use proof::verify_bid_proof;
pub use types::{ZkProof, ZkVerifyError};
