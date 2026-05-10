-- Migration: 0003_auth_nonces.sql
-- Adds a nonce challenge table for wallet-signature login.
--
-- Flow:
--   1. Client  →  GET /auth/nonce?wallet=<address>
--   2. Server  →  generates random nonce, stores here, returns it
--   3. Client  →  signs nonce with wallet private key
--   4. Client  →  POST /login  { wallet_address, signature, nonce }
--   5. Server  →  verifies signature, deletes nonce, issues JWT

CREATE TABLE auth_nonces (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    nonce          TEXT NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by wallet address (one active nonce per wallet at most)
CREATE UNIQUE INDEX idx_auth_nonces_wallet ON auth_nonces (wallet_address);
