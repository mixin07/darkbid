use std::env;

use crate::errors::AppError;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub solana_rpc_url: String,
    pub solana_program_id: String,
    pub server_addr: String,
    pub commit_duration_seconds: u64,
    pub reveal_duration_seconds: u64,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        let database_url = get_env("DATABASE_URL")?;
        let jwt_secret = get_env("JWT_SECRET")?;
        let solana_rpc_url = get_env("SOLANA_RPC_URL")?;
        let solana_program_id = get_env("SOLANA_PROGRAM_ID")?;
        let server_addr = env::var("SERVER_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
        let commit_duration_seconds = get_env_u64("COMMIT_DURATION_SECONDS", 300)?;
        let reveal_duration_seconds = get_env_u64("REVEAL_DURATION_SECONDS", 300)?;

        Ok(Self {
            database_url,
            jwt_secret,
            solana_rpc_url,
            solana_program_id,
            server_addr,
            commit_duration_seconds,
            reveal_duration_seconds,
        })
    }
}

fn get_env(key: &str) -> Result<String, AppError> {
    env::var(key).map_err(|_| AppError::MissingEnv(key.to_string()))
}

fn get_env_u64(key: &str, default_value: u64) -> Result<u64, AppError> {
    match env::var(key) {
        Ok(value) => value
            .parse::<u64>()
            .map_err(|_| AppError::InvalidEnv(key.to_string())),
        Err(_) => Ok(default_value),
    }
}
