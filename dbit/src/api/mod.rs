use axum::{routing::{get, post}, Router};

use crate::state::AppState;

pub mod auth;
mod auctions;
mod bids;
mod health;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::health))
        // ── Auth ──────────────────────────────────────────────────────────
        .route("/auth/nonce", get(auth::request_nonce))
        .route("/register", post(auth::register))
        .route("/login", post(auth::login))
        // ── Auctions ──────────────────────────────────────────────────────
        .route("/auction/create", post(auctions::create_auction))
        .route("/auctions", get(auctions::list_auctions))
        .route("/auction/:id", get(auctions::get_auction))
        .route("/auction/:id/result", get(auctions::get_result))
        // ── Bids ──────────────────────────────────────────────────────────
        .route("/bid/commit", post(bids::commit_bid))
        .route("/bid/reveal", post(bids::reveal_bid))
}

