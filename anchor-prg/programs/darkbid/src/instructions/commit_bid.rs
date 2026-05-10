use anchor_lang::prelude::*;
use crate::state::*;
use crate::constants::*;
use crate::error::*;

pub fn handler(ctx: Context<CommitBid>, hash: [u8; 32], amount: u64) -> Result<()> {
    let auction = &ctx.accounts.auction;
    let clock = Clock::get()?;
    require!(clock.unix_timestamp < auction.end_time, DarkBidError::AuctionEnded);

    let bid = &mut ctx.accounts.bid;
    bid.bidder = ctx.accounts.bidder.key();
    bid.hash = hash;
    bid.amount = amount;
    bid.is_revealed = false;
    bid.bump = ctx.bumps.bid;

    // Transfer SOL via raw system program invoke
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.bidder.key,
            ctx.accounts.escrow.key,
            amount,
        ),
        &[
            ctx.accounts.bidder.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct CommitBid<'info> {
    pub auction: Account<'info, Auction>,
    #[account(
        init,
        payer = bidder,
        space = 8 + 32 + 32 + 8 + 1 + 1,
        seeds = [BID_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid: Account<'info, Bid>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub escrow: SystemAccount<'info>,
    #[account(mut)]
    pub bidder: Signer<'info>,
    pub system_program: Program<'info, System>,
}
