use anchor_lang::prelude::*;
use sha2::{Sha256, Digest};
use crate::state::*;
use crate::constants::*;
use crate::error::*;

pub fn handler(ctx: Context<RevealBid>, amount: u64, secret: u64) -> Result<()> {
    let auction = &ctx.accounts.auction;
    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= auction.end_time, DarkBidError::AuctionNotEnded);
    require!(!auction.is_finalized, DarkBidError::AlreadyFinalized);
    require!(amount >= auction.reserve_price, DarkBidError::BelowReservePrice);

    let mut hasher = Sha256::new();
    hasher.update(amount.to_le_bytes());
    hasher.update(secret.to_le_bytes());
    let result: [u8; 32] = hasher.finalize().into();

    let bid = &mut ctx.accounts.bid;
    require!(result == bid.hash, DarkBidError::InvalidHash);

    bid.is_revealed = true;
    bid.amount = amount;

    Ok(())
}

#[derive(Accounts)]
pub struct RevealBid<'info> {
    pub auction: Account<'info, Auction>,
    #[account(
        mut,
        seeds = [BID_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump = bid.bump
    )]
    pub bid: Account<'info, Bid>,
    pub bidder: Signer<'info>,
}
