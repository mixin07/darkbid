pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use state::*;

use instructions::initialize_auction::*;
use instructions::commit_bid::*;
use instructions::reveal_bid::*;
use instructions::finalize_auction::*;
use instructions::refund::*;

declare_id!("7YWfupxWKmgekRxzrWUUgoWEGSoGS2kz9nyaEbzKHqFK");

#[program]
pub mod darkbid {
    use super::*;

    pub fn initialize_auction(ctx: Context<InitializeAuction>, reserve_price: u64, duration: i64) -> Result<()> {
        instructions::initialize_auction::handler(ctx, reserve_price, duration)
    }

    pub fn commit_bid(ctx: Context<CommitBid>, hash: [u8; 32], amount: u64) -> Result<()> {
        instructions::commit_bid::handler(ctx, hash, amount)
    }

    pub fn reveal_bid(ctx: Context<RevealBid>, amount: u64, secret: u64) -> Result<()> {
        instructions::reveal_bid::handler(ctx, amount, secret)
    }

    pub fn finalize_auction(ctx: Context<FinalizeAuction>) -> Result<()> {
        instructions::finalize_auction::handler(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::handler(ctx)
    }
}
