use anchor_lang::prelude::*;

#[error_code]
pub enum DarkBidError {
    #[msg("Auction has already ended")]
    AuctionEnded,
    #[msg("Auction has not ended yet")]
    AuctionNotEnded,
    #[msg("Bid hash does not match")]
    InvalidHash,
    #[msg("Bid is below reserve price")]
    BelowReservePrice,
    #[msg("Auction already finalized")]
    AlreadyFinalized,
    #[msg("Not the winner")]
    NotWinner,
}
