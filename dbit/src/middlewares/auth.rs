use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::api::auth::{verify_jwt, Claims};
use crate::state::AppState;

/// Authenticated user extracted from the `Authorization: Bearer <jwt>` header.
///
/// Add this as a handler parameter on any route that requires login:
/// ```ignore
/// async fn protected_handler(user: AuthUser, ...) -> ... { ... }
/// ```
#[derive(Debug, Clone)]
pub struct AuthUser {
    /// The user's UUID (parsed from `Claims.sub`).
    pub user_id: Uuid,
    /// The user's wallet address (from the JWT).
    pub wallet: String,
    /// The full set of decoded JWT claims.
    pub claims: Claims,
}

/// Error type returned when authentication fails.
#[derive(Debug)]
pub struct AuthError(String);

#[derive(Serialize)]
struct AuthErrorBody {
    error: String,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let body = Json(AuthErrorBody { error: self.0 });
        (StatusCode::UNAUTHORIZED, body).into_response()
    }
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // 1. Extract the Authorization header
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AuthError("missing Authorization header".into()))?;

        // 2. Must be "Bearer <token>"
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AuthError("Authorization header must be: Bearer <token>".into()))?;

        // 3. Verify the JWT
        let claims = verify_jwt(token, &state.config.jwt_secret)
            .map_err(|e| AuthError(format!("invalid token: {e}")))?;

        // 4. Parse user_id from the `sub` claim
        let user_id: Uuid = claims
            .sub
            .parse()
            .map_err(|_| AuthError("invalid user id in token".into()))?;

        Ok(AuthUser {
            user_id,
            wallet: claims.wallet.clone(),
            claims,
        })
    }
}

