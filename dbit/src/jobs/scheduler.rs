use std::time::Duration;

use chrono::Utc;

use crate::{db::queries, state::AppState};

pub fn spawn_scheduler(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15));
        loop {
            interval.tick().await;
            if let Err(err) = queries::advance_auction_statuses(&state.db, Utc::now()).await {
                tracing::warn!(error = ?err, "scheduler tick failed");
            }
        }
    });
}
