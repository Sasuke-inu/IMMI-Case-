-- Migration: Telegram Login + multi-tenant auth — RLS policies.
-- Enables Row Level Security on IMMI tenant-aware tables and defines access
-- policies. JWT claims are injected by the Worker via:
--   SET LOCAL "request.jwt.claims" = '<json>';
-- inside a transaction before any DML.
--
-- Claim shape:
--   { "sub": "<uuid>", "tenant_id": "<uuid>", "tenants": ["<uuid>"],
--     "role": "owner|member", "kid": "v1", "exp": <unix_ts> }
--
-- NAMING NOTE: helper functions are namespaced `immi_auth_*` so they
-- coexist with any other `auth_*` helpers another application may install
-- in the public schema of this shared Supabase project.

-- ---------------------------------------------------------------------------
-- Helper functions (STABLE — safe to call multiple times per query)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION immi_auth_jwt_claims() RETURNS jsonb AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  )
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION immi_auth_tenant_id() RETURNS uuid AS $$
  SELECT (immi_auth_jwt_claims() ->> 'tenant_id')::uuid
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION immi_auth_user_id() RETURNS uuid AS $$
  SELECT (immi_auth_jwt_claims() ->> 'sub')::uuid
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- Enable RLS on IMMI tenant-aware tables
-- ---------------------------------------------------------------------------
ALTER TABLE immi_collections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE immi_saved_searches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE immi_tenant_members   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- immi_collections policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS immi_collections_tenant_read  ON immi_collections;
DROP POLICY IF EXISTS immi_collections_tenant_write ON immi_collections;

CREATE POLICY immi_collections_tenant_read ON immi_collections
  FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = immi_auth_tenant_id());

CREATE POLICY immi_collections_tenant_write ON immi_collections
  FOR ALL
  USING (tenant_id = immi_auth_tenant_id())
  WITH CHECK (tenant_id = immi_auth_tenant_id());

-- ---------------------------------------------------------------------------
-- immi_saved_searches policies (same pattern as immi_collections)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS immi_saved_searches_tenant_read  ON immi_saved_searches;
DROP POLICY IF EXISTS immi_saved_searches_tenant_write ON immi_saved_searches;

CREATE POLICY immi_saved_searches_tenant_read ON immi_saved_searches
  FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = immi_auth_tenant_id());

CREATE POLICY immi_saved_searches_tenant_write ON immi_saved_searches
  FOR ALL
  USING (tenant_id = immi_auth_tenant_id())
  WITH CHECK (tenant_id = immi_auth_tenant_id());

-- ---------------------------------------------------------------------------
-- council_sessions baseline policy
-- (Per-command refinement happens in 20260514_council_tenant_isolation.sql.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS council_sessions_tenant ON council_sessions;

CREATE POLICY council_sessions_tenant ON council_sessions
  FOR ALL
  USING (tenant_id IS NULL OR tenant_id = immi_auth_tenant_id());

-- ---------------------------------------------------------------------------
-- immi_tenant_members policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS immi_tenant_members_self ON immi_tenant_members;

CREATE POLICY immi_tenant_members_self ON immi_tenant_members
  FOR SELECT
  USING (user_id = immi_auth_user_id());
