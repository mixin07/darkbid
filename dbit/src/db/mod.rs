use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::errors::AppError;

pub async fn connect(database_url: &str) -> Result<PgPool, AppError> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    Ok(pool)
}

pub mod models;
pub mod queries;
