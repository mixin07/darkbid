use dbit::{app, config::AppConfig, db, jobs, state::AppState};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), dbit::errors::AppError> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = AppConfig::from_env()?;
    let pool = db::connect(&config.database_url).await?;
    let state = AppState::new(config, pool);

    let app = app::router(state.clone());
    jobs::spawn_scheduler(state.clone());

    let listener = tokio::net::TcpListener::bind(&state.config.server_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
