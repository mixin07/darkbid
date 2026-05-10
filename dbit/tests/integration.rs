//! Integration tests for the DarkBid API.
//!
//! These tests exercise the full HTTP flow:
//!   register → create auction → commit bid → reveal bid → get result
//!
//! They require a running PostgreSQL instance. Set `DATABASE_URL` in `.env`
//! or as an environment variable. Each test uses unique UUIDs so tests can
//! run in parallel without conflicting.
//!
//! Run with:  cargo test --test integration -- --nocapture

use axum::http::StatusCode;
use axum::Router;
use chrono::{Duration, Utc};
use ed25519_dalek::SigningKey;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

/// Generate a random valid Solana-style wallet address (Base58 of 32-byte Ed25519 pubkey).
fn random_wallet() -> String {
    let mut rng = rand::thread_rng();
    let signing_key = SigningKey::generate(&mut rng);
    bs58::encode(signing_key.verifying_key().as_bytes()).into_string()
}

/// Build the application router with a real database connection.
async fn setup_app() -> (Router, PgPool) {
    dotenvy::dotenv().ok();

    let config = dbit::config::AppConfig::from_env().expect("AppConfig::from_env failed");
    let pool = dbit::db::connect(&config.database_url)
        .await
        .expect("DB connect failed");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations failed");

    let state = dbit::state::AppState::new(config, pool.clone());
    let app = dbit::app::router(state);

    (app, pool)
}

/// Helper: send a JSON POST request.
async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let req = axum::http::Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

/// Helper: send a GET request.
async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let req = axum::http::Request::builder()
        .method("GET")
        .uri(uri)
        .body(axum::body::Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_check() {
    let (app, _pool) = setup_app().await;
    let (status, _) = get_json(&app, "/health").await;
    assert_eq!(status, StatusCode::OK);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn register_returns_token_and_user_id() {
    let (app, _pool) = setup_app().await;

    let wallet = random_wallet();
    let (status, body) = post_json(
        &app,
        "/register",
        json!({
            "wallet_address": wallet,
            "password": "test_password_123"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "register failed: {body}");
    assert!(body["token"].is_string(), "should return a JWT token");
    assert!(body["user_id"].is_string(), "should return a user_id");
}

#[tokio::test]
async fn register_duplicate_wallet_fails() {
    let (app, _pool) = setup_app().await;

    let wallet = random_wallet();
    let payload = json!({ "wallet_address": wallet });

    let (s1, _) = post_json(&app, "/register", payload.clone()).await;
    assert_eq!(s1, StatusCode::OK);

    // Second registration with the same wallet should fail
    let (s2, _) = post_json(&app, "/register", payload).await;
    assert_ne!(s2, StatusCode::OK, "duplicate wallet should be rejected");
}

// ─────────────────────────────────────────────────────────────────────────────
// Auction creation
// ─────────────────────────────────────────────────────────────────────────────

/// Helper: register a user and return (user_id, wallet_address)
async fn register_user(app: &Router) -> (Uuid, String) {
    let wallet = random_wallet();
    let (status, body) = post_json(
        app,
        "/register",
        json!({ "wallet_address": wallet }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "register_user failed: {body}");
    let user_id: Uuid = body["user_id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    (user_id, wallet)
}

#[tokio::test]
async fn create_auction_returns_detail() {
    let (app, _pool) = setup_app().await;
    let (creator_id, _wallet) = register_user(&app).await;

    let (status, body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Integration Test Auction",
            "reserve_price": 100,
            "commit_duration_seconds": 60,
            "reveal_duration_seconds": 60
        }),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "create_auction failed: {body}");
    assert_eq!(body["title"], "Integration Test Auction");
    assert_eq!(body["reserve_price"], 100);
    assert_eq!(body["status"], "Active");
    assert!(body["id"].is_string());
    assert!(body["commit_end_at"].is_string());
    assert!(body["reveal_end_at"].is_string());
    assert!(body["created_at"].is_string());
}

#[tokio::test]
async fn create_auction_rejects_empty_title() {
    let (app, _pool) = setup_app().await;
    let (creator_id, _) = register_user(&app).await;

    let (status, body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "   ",
            "reserve_price": 100
        }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST, "empty title should fail: {body}");
}

#[tokio::test]
async fn create_auction_rejects_negative_reserve() {
    let (app, _pool) = setup_app().await;
    let (creator_id, _) = register_user(&app).await;

    let (status, _) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Neg Reserve",
            "reserve_price": -1
        }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
}

// ─────────────────────────────────────────────────────────────────────────────
// List / Get auction
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_and_get_auction() {
    let (app, _pool) = setup_app().await;
    let (creator_id, _) = register_user(&app).await;

    // Create
    let (_, create_body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "List Test",
            "reserve_price": 50,
            "commit_duration_seconds": 60,
            "reveal_duration_seconds": 60
        }),
    )
    .await;
    let auction_id = create_body["id"].as_str().unwrap();

    // List
    let (status, list_body) = get_json(&app, "/auctions").await;
    assert_eq!(status, StatusCode::OK);
    assert!(list_body.is_array());

    // Get by ID
    let (status, detail) = get_json(&app, &format!("/auction/{auction_id}")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(detail["id"], auction_id);
    assert_eq!(detail["title"], "List Test");
}

// ─────────────────────────────────────────────────────────────────────────────
// Result endpoint (without bids)
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn result_on_active_auction_shows_no_winner() {
    let (app, _pool) = setup_app().await;
    let (creator_id, _) = register_user(&app).await;

    let (_, create_body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Result Test",
            "reserve_price": 100,
            "commit_duration_seconds": 300,
            "reveal_duration_seconds": 300
        }),
    )
    .await;
    let auction_id = create_body["id"].as_str().unwrap();

    let (status, result) = get_json(&app, &format!("/auction/{auction_id}/result")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["auction_id"], auction_id);
    assert_eq!(result["total_bids"], 0);
    assert!(result["winner"].is_null());
}

// ─────────────────────────────────────────────────────────────────────────────
// Full flow: create auction → advance to ENDED → result with winner
// (uses direct DB manipulation to simulate time passage and skip Solana RPC)
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn full_flow_with_db_manipulation() {
    let (app, pool) = setup_app().await;

    // ── 1. Register creator + bidder ──────────────────────────────────────
    let (creator_id, _) = register_user(&app).await;
    let (bidder_id, _bidder_wallet) = register_user(&app).await;

    // ── 2. Create auction (short durations, we'll manually override) ──────
    let (status, auction_body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Full Flow Test",
            "reserve_price": 100,
            "commit_duration_seconds": 300,
            "reveal_duration_seconds": 300
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let auction_id: Uuid = auction_body["id"].as_str().unwrap().parse().unwrap();

    // ── 3. Insert a bid directly (skip Solana verification) ───────────────
    let bid_id = Uuid::new_v4();
    let nonce = "test_nonce_123";
    let commit_hash = dbit::utils::hashing::commit_hash(500, nonce, &bidder_id);

    sqlx::query!(
        r#"
        INSERT INTO bids (id, auction_id, bidder_id, commit_hash, commit_tx_sig)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        bid_id,
        auction_id,
        bidder_id,
        commit_hash,
        "fake_commit_tx_sig",
    )
    .execute(&pool)
    .await
    .expect("insert bid failed");

    // ── 4. Advance auction to REVEAL and then reveal the bid ──────────────
    let past = Utc::now() - Duration::seconds(10);
    sqlx::query!(
        "UPDATE auctions SET status = 'REVEAL', commit_end_at = $1 WHERE id = $2",
        past,
        auction_id,
    )
    .execute(&pool)
    .await
    .unwrap();

    // Reveal the bid directly (is_valid = true because 500 >= 100 reserve)
    sqlx::query!(
        r#"
        UPDATE bids
        SET reveal_amount = $1, reveal_tx_sig = $2, revealed_at = NOW(), is_valid = $3
        WHERE id = $4
        "#,
        500_i64,
        "fake_reveal_tx_sig",
        true,
        bid_id,
    )
    .execute(&pool)
    .await
    .unwrap();

    // ── 5. Advance auction to ENDED ───────────────────────────────────────
    sqlx::query!(
        "UPDATE auctions SET status = 'ENDED', reveal_end_at = $1 WHERE id = $2",
        past,
        auction_id,
    )
    .execute(&pool)
    .await
    .unwrap();

    // ── 6. GET /auction/:id/result → should pick our bid as winner ────────
    let (status, result) = get_json(&app, &format!("/auction/{auction_id}/result")).await;
    assert_eq!(status, StatusCode::OK, "get_result failed: {result}");
    assert_eq!(result["status"], "Ended");
    assert_eq!(result["total_bids"], 1);
    assert_eq!(result["revealed_bids"], 1);
    assert_eq!(result["valid_bids"], 1);

    let winner = &result["winner"];
    assert!(!winner.is_null(), "should have a winner");
    assert_eq!(winner["bid_id"], bid_id.to_string());
    assert_eq!(winner["bidder_id"], bidder_id.to_string());
    assert_eq!(winner["amount"], 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multiple bidders — highest valid bid wins
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn highest_valid_bid_wins_in_result() {
    let (app, pool) = setup_app().await;

    let (creator_id, _) = register_user(&app).await;
    let (bidder_a, _) = register_user(&app).await;
    let (bidder_b, _) = register_user(&app).await;

    // Create auction with reserve = 100
    let (_, auction_body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Multi Bidder Test",
            "reserve_price": 100,
            "commit_duration_seconds": 300,
            "reveal_duration_seconds": 300
        }),
    )
    .await;
    let auction_id: Uuid = auction_body["id"].as_str().unwrap().parse().unwrap();

    let past = Utc::now() - Duration::seconds(10);

    // Insert two bids directly
    let bid_a = Uuid::new_v4();
    let bid_b = Uuid::new_v4();
    let hash_a = dbit::utils::hashing::commit_hash(200, "na", &bidder_a);
    let hash_b = dbit::utils::hashing::commit_hash(800, "nb", &bidder_b);

    for (bid_id, bidder_id, hash, amount) in [
        (bid_a, bidder_a, hash_a.as_str(), 200_i64),
        (bid_b, bidder_b, hash_b.as_str(), 800_i64),
    ] {
        sqlx::query!(
            "INSERT INTO bids (id, auction_id, bidder_id, commit_hash, commit_tx_sig) VALUES ($1,$2,$3,$4,$5)",
            bid_id, auction_id, bidder_id, hash, "fake_sig",
        ).execute(&pool).await.unwrap();

        sqlx::query!(
            "UPDATE bids SET reveal_amount=$1, reveal_tx_sig=$2, revealed_at=NOW(), is_valid=$3 WHERE id=$4",
            amount, "fake_reveal", true, bid_id,
        ).execute(&pool).await.unwrap();
    }

    // End the auction
    sqlx::query!(
        "UPDATE auctions SET status='ENDED', commit_end_at=$1, reveal_end_at=$1 WHERE id=$2",
        past, auction_id,
    )
    .execute(&pool)
    .await
    .unwrap();

    // Get result
    let (status, result) = get_json(&app, &format!("/auction/{auction_id}/result")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["valid_bids"], 2);

    let winner = &result["winner"];
    assert_eq!(winner["bid_id"], bid_b.to_string(), "highest bid should win");
    assert_eq!(winner["amount"], 800);
}

// ─────────────────────────────────────────────────────────────────────────────
// Below-reserve bid is excluded from winner
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn below_reserve_bid_not_eligible() {
    let (app, pool) = setup_app().await;

    let (creator_id, _) = register_user(&app).await;
    let (bidder_id, _) = register_user(&app).await;

    let (_, auction_body) = post_json(
        &app,
        "/auction/create",
        json!({
            "creator_id": creator_id,
            "title": "Reserve Test",
            "reserve_price": 500,
            "commit_duration_seconds": 300,
            "reveal_duration_seconds": 300
        }),
    )
    .await;
    let auction_id: Uuid = auction_body["id"].as_str().unwrap().parse().unwrap();

    // Insert a bid below reserve
    let bid_id = Uuid::new_v4();
    let hash = dbit::utils::hashing::commit_hash(100, "n", &bidder_id);
    sqlx::query!(
        "INSERT INTO bids (id, auction_id, bidder_id, commit_hash, commit_tx_sig) VALUES ($1,$2,$3,$4,$5)",
        bid_id, auction_id, bidder_id, hash, "fake",
    ).execute(&pool).await.unwrap();

    // Reveal with is_valid = false (100 < 500 reserve)
    sqlx::query!(
        "UPDATE bids SET reveal_amount=$1, reveal_tx_sig=$2, revealed_at=NOW(), is_valid=$3 WHERE id=$4",
        100_i64, "fake", false, bid_id,
    ).execute(&pool).await.unwrap();

    let past = Utc::now() - Duration::seconds(10);
    sqlx::query!(
        "UPDATE auctions SET status='ENDED', commit_end_at=$1, reveal_end_at=$1 WHERE id=$2",
        past, auction_id,
    )
    .execute(&pool)
    .await
    .unwrap();

    let (status, result) = get_json(&app, &format!("/auction/{auction_id}/result")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(result["total_bids"], 1);
    assert_eq!(result["revealed_bids"], 1);
    assert_eq!(result["valid_bids"], 0, "below-reserve bid should not be valid");
    assert!(result["winner"].is_null(), "no valid bids → no winner");
}
