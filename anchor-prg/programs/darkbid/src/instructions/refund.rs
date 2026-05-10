use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::*;
use crate::error::*;

pub fn handler(ctx: Context<Refund>) -> Result<()> {
    let auction = &ctx.accounts.auction;
    let bid = &ctx.accounts.bid;

    require!(auction.is_finalized, DarkBidError::AuctionNotEnded);

    if let Some(winner) = auction.winner {
        require!(winner != bid.bidder, DarkBidError::NotWinner);
    }

    let refund_amount = ctx.accounts.escrow.lamports();
    **ctx.accounts.escrow.try_borrow_mut_lamports()? -= refund_amount;
    **ctx.accounts.bidder.try_borrow_mut_lamports()? += refund_amount;

    Ok(())
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub auction: Account<'info, Auction>,
    #[account(
        seeds = [BID_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump = bid.bump
    )]
    pub bid: Account<'info, Bid>,
    /// CHECK: escrow PDA holding SOL
    #[account(
        mut,
        seeds = [ESCROW_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,
    #[account(mut)]
    pub bidder: Signer<'info>,
}
