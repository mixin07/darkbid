use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::*;
use crate::error::*;

pub fn handler(ctx: Context<FinalizeAuction>) -> Result<()> {
    let clock = Clock::get()?;
    let auction = &mut ctx.accounts.auction;

    require!(clock.unix_timestamp >= auction.end_time, DarkBidError::AuctionNotEnded);
    require!(!auction.is_finalized, DarkBidError::AlreadyFinalized);

    let winner_bid = &ctx.accounts.winner_bid;
    require!(winner_bid.is_revealed, DarkBidError::InvalidHash);
    require!(winner_bid.amount >= auction.reserve_price, DarkBidError::BelowReservePrice);

    auction.is_finalized = true;
    auction.winner = Some(winner_bid.bidder);

    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeAuction<'info> {
    #[account(
        mut,
        seeds = [AUCTION_SEED, authority.key().as_ref()],
        bump = auction.bump
    )]
    pub auction: Account<'info, Auction>,
    #[account(
        seeds = [BID_SEED, auction.key().as_ref(), winner_bid.bidder.as_ref()],
        bump = winner_bid.bump
    )]
    pub winner_bid: Account<'info, Bid>,
    pub authority: Signer<'info>,
}
