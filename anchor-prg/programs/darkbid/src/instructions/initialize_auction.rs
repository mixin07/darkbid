use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::constants::*;
use crate::error::*;

pub fn handler(ctx: Context<InitializeAuction>, reserve_price: u64, duration: i64) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    auction.authority = ctx.accounts.authority.key();
    auction.reserve_price = reserve_price;
    auction.end_time = Clock::get()?.unix_timestamp + duration;
    auction.is_finalized = false;
    auction.winner = None;
    auction.bump = ctx.bumps.auction;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeAuction<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 8 + 1 + 33 + 1, seeds = [AUCTION_SEED, authority.key().as_ref()], bump)]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}
