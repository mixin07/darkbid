use axum::{http::StatusCode, response::IntoResponse, response::Response, Json};
use serde::Serialize;

use crate::zk::types::ZkVerifyError;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("missing env: {0}")]
    MissingEnv(String),
    #[error("invalid env: {0}")]
    InvalidEnv(String),
    #[error("database error")]
    Db(#[from] sqlx::Error),
    #[error("io error")]
    Io(#[from] std::io::Error),
    #[error("jwt error")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("not implemented: {0}")]
    NotImplemented(String),
    #[error("zk proof error: {0}")]
    ZkVerify(#[from] ZkVerifyError),
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match self {
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::ZkVerify(_)   => StatusCode::BAD_REQUEST,
            AppError::Jwt(_) => StatusCode::UNAUTHORIZED,
            AppError::NotImplemented(_) => StatusCode::NOT_IMPLEMENTED,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(ErrorBody {
            error: self.to_string(),
        });
        (status, body).into_response()
    }
}
