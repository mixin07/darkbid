use axum::Router;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};

use crate::{api, state::AppState};

pub fn router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .merge(api::routes())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
