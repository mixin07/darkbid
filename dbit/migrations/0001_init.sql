CREATE TABLE users (
  id UUID PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE auction_status AS ENUM ('ACTIVE', 'REVEAL', 'ENDED');

CREATE TABLE auctions (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  reserve_price BIGINT NOT NULL,
  status auction_status NOT NULL DEFAULT 'ACTIVE',
  commit_end_at TIMESTAMPTZ NOT NULL,
  reveal_end_at TIMESTAMPTZ NOT NULL,
  winner_bid_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bids (
  id UUID PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES auctions(id),
  bidder_id UUID NOT NULL REFERENCES users(id),
  commit_hash TEXT NOT NULL,
  commit_tx_sig TEXT NOT NULL,
  reveal_amount BIGINT,
  reveal_tx_sig TEXT,
  revealed_at TIMESTAMPTZ,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  commit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON bids(auction_id);
CREATE INDEX idx_auctions_status ON auctions(status);
