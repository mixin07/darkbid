use axum::{extract::{Query, State}, Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
};

// ─────────────────────────────────────────────────────────────────────────────
// JWT Claims
// ─────────────────────────────────────────────────────────────────────────────

/// Standard JWT claims issued by this server.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject – the user's UUID.
    pub sub: String,
    /// Wallet address (convenience field so clients don't need a DB round-trip).
    pub wallet: String,
    /// Issued-at timestamp (seconds since epoch).
    pub iat: i64,
    /// Expiry timestamp (seconds since epoch).
    pub exp: i64,
}

/// How long a JWT lives (24 hours).
const JWT_LIFETIME_HOURS: i64 = 24;

/// Issue a signed JWT for the given user.
pub fn issue_jwt(
    user_id: &Uuid,
    wallet_address: &str,
    jwt_secret: &str,
) -> Result<String, AppError> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        wallet: wallet_address.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::hours(JWT_LIFETIME_HOURS)).timestamp(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?;
    Ok(token)
}

/// Decode and verify a JWT, returning the embedded claims.
pub fn verify_jwt(token: &str, jwt_secret: &str) -> Result<Claims, AppError> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct RegisterRequest {
    /// Solana wallet address (Base58-encoded public key).
    pub wallet_address: String,
    /// Optional e-mail for notifications.
    pub email: Option<String>,
    /// Optional password — when provided the user can also log in with password.
    pub password: Option<String>,
}

#[derive(Serialize)]
pub struct AuthResponse {
    /// Signed JWT.
    pub token: String,
    /// The user's UUID (for convenience).
    pub user_id: Uuid,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<Json<AuthResponse>> {
    // ── Validate wallet address (must be valid Base58, 32-byte Ed25519 pubkey) ──
    let pubkey_bytes = bs58::decode(&req.wallet_address)
        .into_vec()
        .map_err(|_| AppError::Validation("invalid Base58 wallet address".into()))?;
    if pubkey_bytes.len() != 32 {
        return Err(AppError::Validation(
            "wallet address must decode to 32 bytes".into(),
        ));
    }

    // ── Hash the password (if provided) with Argon2id ──────────────────────
    let password_hash: Option<String> = match &req.password {
        Some(pw) if !pw.is_empty() => {
            use argon2::password_hash::PasswordHasher;
            let salt = argon2::password_hash::SaltString::generate(&mut rand::thread_rng());
            let hash = argon2::Argon2::default()
                .hash_password(pw.as_bytes(), &salt)
                .map_err(|e| AppError::Validation(format!("password hash failed: {e}")))?
                .to_string();
            Some(hash)
        }
        _ => None,
    };

    // ── Insert user ────────────────────────────────────────────────────────
    let user_id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO users (id, wallet_address, email, password_hash)
        VALUES ($1, $2, $3, $4)
        "#,
        user_id,
        req.wallet_address,
        req.email,
        password_hash,
    )
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::Validation("wallet address already registered".into())
        }
        other => AppError::Db(other),
    })?;

    // ── Issue JWT ──────────────────────────────────────────────────────────
    let token = issue_jwt(&user_id, &req.wallet_address, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse { token, user_id }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Login — dual mode (wallet signature OR password)
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LoginRequest {
    /// Solana wallet address.
    pub wallet_address: String,

    // ── Wallet-signature login fields (recommended) ─────────────────────────
    /// The original challenge nonce returned by `GET /auth/nonce`.
    pub nonce: Option<String>,
    /// Ed25519 signature of the nonce, produced by the wallet (Base58-encoded).
    pub signature: Option<String>,

    // ── Password login field ────────────────────────────────────────────────
    /// Argon2-hashed password (alternative to wallet-signature login).
    pub password: Option<String>,
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    let has_wallet_auth = req.nonce.is_some() && req.signature.is_some();
    let has_password    = req.password.is_some();

    // Look up user optionally
    let user_opt = sqlx::query!(
        r#"
        SELECT id, wallet_address, password_hash
        FROM   users
        WHERE  wallet_address = $1
        "#,
        req.wallet_address,
    )
    .fetch_optional(&state.db)
    .await?;

    if has_wallet_auth {
        let nonce     = req.nonce.as_ref().unwrap();
        let sig_b58   = req.signature.as_ref().unwrap();

        let nonce_row = sqlx::query!(
            r#"
            SELECT id, nonce, expires_at
            FROM   auth_nonces
            WHERE  wallet_address = $1
            "#,
            req.wallet_address,
        )
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Validation("no active nonce for this wallet — call GET /auth/nonce first".into()))?;

        if nonce_row.nonce != *nonce {
            return Err(AppError::Validation("nonce mismatch".into()));
        }
        if nonce_row.expires_at < Utc::now() {
            sqlx::query!("DELETE FROM auth_nonces WHERE id = $1", nonce_row.id)
                .execute(&state.db)
                .await?;
            return Err(AppError::Validation("nonce expired — request a new one".into()));
        }

        let pubkey_bytes = bs58::decode(&req.wallet_address)
            .into_vec()
            .map_err(|_| AppError::Validation("invalid Base58 wallet address".into()))?;

        use ed25519_dalek::{Signature, Verifier, VerifyingKey};
        let verifying_key = VerifyingKey::from_bytes(
            pubkey_bytes
                .as_slice()
                .try_into()
                .map_err(|_| AppError::Validation("wallet address must be 32 bytes".into()))?,
        )
        .map_err(|_| AppError::Validation("invalid Ed25519 public key".into()))?;

        let sig_bytes = bs58::decode(sig_b58)
            .into_vec()
            .map_err(|_| AppError::Validation("invalid Base58 signature".into()))?;

        let signature = Signature::from_bytes(
            sig_bytes
                .as_slice()
                .try_into()
                .map_err(|_| AppError::Validation("signature must be 64 bytes".into()))?,
        );

        let expected_message = format!("Sign this message to authenticate with DarkBid\nNonce: {}", nonce);
        verifying_key
            .verify(expected_message.as_bytes(), &signature)
            .map_err(|_| AppError::Validation("signature verification failed".into()))?;

        sqlx::query!("DELETE FROM auth_nonces WHERE id = $1", nonce_row.id)
            .execute(&state.db)
            .await?;

        // Auto-register user if they don't exist
        let user_id = if let Some(u) = user_opt {
            u.id
        } else {
            let new_id = Uuid::new_v4();
            sqlx::query!(
                "INSERT INTO users (id, wallet_address) VALUES ($1, $2)",
                new_id,
                req.wallet_address,
            )
            .execute(&state.db)
            .await?;
            new_id
        };

        let token = issue_jwt(&user_id, &req.wallet_address, &state.config.jwt_secret)?;
        return Ok(Json(AuthResponse { token, user_id }));

    } else if has_password {
        let user = user_opt.ok_or_else(|| AppError::Validation("unknown wallet address".into()))?;
        let password = req.password.as_ref().unwrap();
        let stored_hash = user.password_hash.as_deref().ok_or_else(|| {
            AppError::Validation("this account has no password — use wallet-signature login".into())
        })?;

        use argon2::password_hash::{PasswordHash, PasswordVerifier};
        let parsed = PasswordHash::new(stored_hash)
            .map_err(|e| AppError::Validation(format!("stored hash corrupt: {e}")))?;

        argon2::Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .map_err(|_| AppError::Validation("incorrect password".into()))?;

        let token = issue_jwt(&user.id, &user.wallet_address, &state.config.jwt_secret)?;
        return Ok(Json(AuthResponse { token, user_id: user.id }));

    } else {
        return Err(AppError::Validation("provide either (nonce + signature) or password".into()));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nonce challenge for wallet login
// ─────────────────────────────────────────────────────────────────────────────

/// How long a challenge nonce is valid (5 minutes).
const NONCE_LIFETIME_MINUTES: i64 = 5;

#[derive(Deserialize)]
pub struct NonceQuery {
    /// The wallet address requesting a login challenge.
    pub wallet: String,
}

#[derive(Serialize)]
pub struct NonceResponse {
    /// The challenge nonce the wallet must sign.
    pub nonce: String,
    /// ISO-8601 timestamp when the nonce expires.
    pub expires_at: String,
}

/// `GET /auth/nonce?wallet=<address>`
///
/// Returns a fresh random nonce for the given wallet. If an existing nonce
/// is still active it is replaced (upsert).
pub async fn request_nonce(
    State(state): State<AppState>,
    Query(q): Query<NonceQuery>,
) -> AppResult<Json<NonceResponse>> {
    // Validate wallet address format
    let pk_bytes = bs58::decode(&q.wallet)
        .into_vec()
        .map_err(|_| AppError::Validation("invalid Base58 wallet address".into()))?;
    if pk_bytes.len() != 32 {
        return Err(AppError::Validation(
            "wallet address must decode to 32 bytes".into(),
        ));
    }

    // Generate a random 32-byte hex nonce
    use rand::Rng;
    let nonce: String = {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill(&mut bytes);
        hex::encode(bytes)
    };

    let expires_at = Utc::now() + Duration::minutes(NONCE_LIFETIME_MINUTES);

    // Upsert: one active nonce per wallet at most (ON CONFLICT on the unique index)
    sqlx::query!(
        r#"
        INSERT INTO auth_nonces (wallet_address, nonce, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (wallet_address)
        DO UPDATE SET nonce = EXCLUDED.nonce,
                      expires_at = EXCLUDED.expires_at,
                      created_at = NOW()
        "#,
        q.wallet,
        nonce,
        expires_at,
    )
    .execute(&state.db)
    .await?;

    Ok(Json(NonceResponse {
        nonce,
        expires_at: expires_at.to_rfc3339(),
    }))
}

