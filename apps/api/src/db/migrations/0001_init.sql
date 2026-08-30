-- NexusKey — initial schema
-- This database is an indexed read cache of the GenLayer Intelligent
-- Contract. It is never the source of truth for claim status, bond
-- accounting, or settlement — see docs/DATABASE.md.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address text NOT NULL UNIQUE,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
    property_key text PRIMARY KEY,
    country text NOT NULL,
    state_or_region text NOT NULL,
    city text NOT NULL,
    normalized_street_address text NOT NULL,
    normalized_unit text NOT NULL DEFAULT '',
    display_address text,
    active_claim_count integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_city ON properties (city);
CREATE INDEX idx_properties_state ON properties (state_or_region);

CREATE TABLE claims (
    claim_id bigint PRIMARY KEY,
    property_key text NOT NULL REFERENCES properties (property_key),
    claimant_wallet text NOT NULL,
    claimant_user_id uuid REFERENCES users (id),
    claimant_name text NOT NULL,
    authority_type text NOT NULL,
    listing_title text NOT NULL,
    listing_description text NOT NULL,
    evidence_url text NOT NULL,
    image_references text[] NOT NULL DEFAULT '{}',
    status text NOT NULL,
    bond_amount_wei numeric(78, 0) NOT NULL DEFAULT 0,
    bond_deposited_wei numeric(78, 0) NOT NULL DEFAULT 0,
    created_at_chain timestamptz NOT NULL,
    verified_at timestamptz,
    verification_expires_at timestamptz,
    challenge_window_ends_at timestamptz,
    resolution_code text,
    renewed_from_claim_id bigint REFERENCES claims (claim_id),
    revoked_at timestamptz,
    indexed_at timestamptz NOT NULL DEFAULT now(),
    last_synced_tx_hash text,
    CONSTRAINT chk_claims_status CHECK (
        status IN (
            'PENDING', 'VERIFICATION_REQUIRED', 'CONTEST_WINDOW', 'CHALLENGED',
            'VERIFIED', 'REJECTED', 'RESOLVED_CLAIMANT_WINS',
            'RESOLVED_CHALLENGER_WINS', 'EXPIRED', 'REVOKED'
        )
    ),
    CONSTRAINT chk_claims_authority_type CHECK (
        authority_type IN (
            'PROPERTY_OWNER', 'PROPERTY_MANAGER', 'AUTHORIZED_AGENT',
            'AUTHORIZED_SUBLESSOR', 'OTHER_AUTHORIZED_REPRESENTATIVE', 'UNKNOWN'
        )
    )
);

CREATE INDEX idx_claims_property_status ON claims (property_key, status);
CREATE INDEX idx_claims_claimant_wallet ON claims (claimant_wallet);
CREATE INDEX idx_claims_status_expiry ON claims (status, verification_expires_at);

CREATE TABLE claim_status_history (
    id bigserial PRIMARY KEY,
    claim_id bigint NOT NULL REFERENCES claims (claim_id),
    from_status text,
    to_status text NOT NULL,
    reason_code text,
    tx_hash text,
    occurred_at timestamptz NOT NULL,
    UNIQUE (claim_id, to_status, tx_hash)
);

CREATE INDEX idx_claim_status_history_claim ON claim_status_history (claim_id, occurred_at);

CREATE TABLE challenges (
    challenge_id bigint PRIMARY KEY,
    claim_id bigint NOT NULL REFERENCES claims (claim_id),
    challenger_wallet text NOT NULL,
    challenger_user_id uuid REFERENCES users (id),
    reason text NOT NULL,
    evidence_url text NOT NULL,
    supporting_info text NOT NULL DEFAULT '',
    bond_amount_wei numeric(78, 0) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'PENDING',
    resolution_code text,
    created_at_chain timestamptz NOT NULL,
    resolved_at timestamptz,
    indexed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_challenges_status CHECK (
        status IN ('PENDING', 'RESOLVED_CLAIMANT_WINS', 'RESOLVED_CHALLENGER_WINS')
    ),
    CONSTRAINT chk_challenges_reason CHECK (
        reason IN (
            'UNAUTHORIZED_LISTING', 'FALSE_PROPERTY_CONTROL', 'COPIED_LISTING',
            'MISREPRESENTED_AUTHORITY', 'UNIT_DOES_NOT_MATCH', 'EXPIRED_AUTHORITY', 'OTHER'
        )
    )
);

CREATE INDEX idx_challenges_claim ON challenges (claim_id);
CREATE INDEX idx_challenges_challenger_wallet ON challenges (challenger_wallet);

-- Enforce "only one open challenge per claim" at the index layer too — the
-- contract is authoritative for this rule, but the indexer should never be
-- able to represent an impossible state locally.
CREATE UNIQUE INDEX uq_challenges_one_pending_per_claim
    ON challenges (claim_id)
    WHERE status = 'PENDING';

CREATE TABLE challenge_status_history (
    id bigserial PRIMARY KEY,
    challenge_id bigint NOT NULL REFERENCES challenges (challenge_id),
    from_status text,
    to_status text NOT NULL,
    reason_code text,
    tx_hash text,
    occurred_at timestamptz NOT NULL,
    UNIQUE (challenge_id, to_status, tx_hash)
);

CREATE TABLE claim_evidence_snapshots (
    id bigserial PRIMARY KEY,
    claim_id bigint NOT NULL REFERENCES claims (claim_id),
    fetched_at timestamptz NOT NULL DEFAULT now(),
    http_status integer,
    content_hash text,
    title_extract text,
    truncated_body_extract text
);

CREATE INDEX idx_evidence_snapshots_claim ON claim_evidence_snapshots (claim_id, fetched_at DESC);

CREATE TABLE sync_cursor (
    id integer PRIMARY KEY DEFAULT 1,
    last_block_or_seq bigint NOT NULL DEFAULT 0,
    last_synced_at timestamptz,
    CONSTRAINT chk_sync_cursor_singleton CHECK (id = 1)
);
INSERT INTO sync_cursor (id, last_block_or_seq) VALUES (1, 0);

CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
