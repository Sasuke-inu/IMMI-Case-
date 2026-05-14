-- Migration: Telegram Login + multi-tenant auth — core tenancy tables.
-- Creates: immi_users, immi_tenants, immi_tenant_members, immi_tenant_invites,
--          immi_collections, immi_saved_searches
-- Extends: council_sessions with tenant context (tenant_id, created_by)
-- Idempotent: uses IF NOT EXISTS guards throughout.
--
-- NAMING NOTE (plan §schema-isolation): IMMI tenancy tables carry the `immi_`
-- prefix so they coexist with another application's `users`/`tenants` tables
-- that share this Supabase project. Worker code in workers/auth/handlers.js
-- and workers/proxy.js references these prefixed names directly.

-- ---------------------------------------------------------------------------
-- immi_users (Telegram identity store)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_users (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id       bigint      NOT NULL,
  username          text,
  first_name        text,
  last_name         text,
  photo_url         text,
  primary_tenant_id uuid,       -- FK added below after immi_tenants exists
  created_at        timestamptz DEFAULT now(),
  last_login_at     timestamptz,
  deleted_at        timestamptz
);

-- Soft-delete-aware unique index: one active record per Telegram user
CREATE UNIQUE INDEX IF NOT EXISTS immi_users_telegram_id_uniq
  ON immi_users(telegram_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- immi_tenants (individual account or organization workspace)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_tenants (
  id         uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text  NOT NULL CHECK (kind IN ('individual', 'organization')),
  name       text  NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add FK from immi_users → immi_tenants (both tables now exist).
-- Postgres does NOT support `ADD CONSTRAINT IF NOT EXISTS`, so we wrap in a
-- DO block. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'immi_users_primary_tenant_fk'
  ) THEN
    ALTER TABLE immi_users
      ADD CONSTRAINT immi_users_primary_tenant_fk
      FOREIGN KEY (primary_tenant_id) REFERENCES immi_tenants(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- immi_tenant_members (many-to-many: immi_users ↔ immi_tenants, with roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_tenant_members (
  tenant_id   uuid NOT NULL REFERENCES immi_tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES immi_users(id)   ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('owner', 'member')),
  invited_by  uuid REFERENCES immi_users(id),
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS immi_tenant_members_user_idx
  ON immi_tenant_members(user_id, tenant_id);

-- ---------------------------------------------------------------------------
-- immi_tenant_invites (invite-link tokens; store hash only — never raw)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_tenant_invites (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid  NOT NULL REFERENCES immi_tenants(id) ON DELETE CASCADE,
  invited_by  uuid  REFERENCES immi_users(id),
  token_hash  text  NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immi_tenant_invites_cleanup_idx
  ON immi_tenant_invites(tenant_id, expires_at);

-- ---------------------------------------------------------------------------
-- immi_collections (case groupings — migrated from localStorage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_collections (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid    REFERENCES immi_tenants(id),
  created_by  uuid    REFERENCES immi_users(id),
  name        text    NOT NULL,
  description text,
  case_ids    text[]  DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immi_collections_tenant_idx
  ON immi_collections(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- immi_saved_searches (filter presets — migrated from localStorage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS immi_saved_searches (
  id          uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid   REFERENCES immi_tenants(id),
  created_by  uuid   REFERENCES immi_users(id),
  name        text   NOT NULL,
  filters     jsonb  NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immi_saved_searches_tenant_idx
  ON immi_saved_searches(tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Extend council_sessions with tenant context (additive — no data loss)
-- ---------------------------------------------------------------------------
ALTER TABLE council_sessions
  ADD COLUMN IF NOT EXISTS tenant_id  uuid REFERENCES immi_tenants(id),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES immi_users(id);

CREATE INDEX IF NOT EXISTS council_sessions_tenant_idx
  ON council_sessions(tenant_id)
  WHERE tenant_id IS NOT NULL;
