use sqlx::PgPool;

use crate::config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub db: PgPool,
    /// Shared HTTP client for Solana RPC and external calls.
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(config: AppConfig, db: PgPool) -> Self {
        Self {
            config,
            db,
            http: reqwest::Client::new(),
        }
    }
}

