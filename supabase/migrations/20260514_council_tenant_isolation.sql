-- Migration: tighten LLM Council tenant isolation policies (plan §1.4).
--
-- Previously council_sessions had one permissive policy:
--   FOR ALL USING (tenant_id IS NULL OR tenant_id = auth_tenant_id())
-- which let any caller — including unauthenticated ones — INSERT rows with
-- tenant_id = NULL, defeating the tenant isolation guarantee on writes.
--
-- This migration replaces that single policy with four explicit policies:
--
--   SELECT: read your own tenant rows + legacy anonymous (tenant_id IS NULL)
--           rows.  Read-only compat path for sessions created before
--           multi-tenant auth landed.
--
--   INSERT: WITH CHECK (tenant_id = auth_tenant_id())
--           Every new row MUST be bound to the authenticated caller's tenant.
--           This is the core of the plan — no new anonymous rows.
--
--   UPDATE: USING + WITH CHECK both pinned to auth_tenant_id().
--           No tenant rebinding via update; legacy NULL rows are not mutable.
--
--   DELETE: USING (tenant_id = auth_tenant_id()).
--           No deletion of legacy NULL rows from the API.
--
-- council_turns inherits scoping via the parent council_sessions FK and gets
-- its own tenant-aware policy.  We attach RLS here so anyone querying through
-- the Worker's getSqlAsUser transaction wrapper is restricted via JWT claims.
--
-- Idempotent: drops & recreates policies, uses IF NOT EXISTS guards.

-- ---------------------------------------------------------------------------
-- council_sessions: explicit per-command policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS council_sessions_tenant ON council_sessions;
DROP POLICY IF EXISTS council_sessions_select ON council_sessions;
DROP POLICY IF EXISTS council_sessions_insert ON council_sessions;
DROP POLICY IF EXISTS council_sessions_update ON council_sessions;
DROP POLICY IF EXISTS council_sessions_delete ON council_sessions;

CREATE POLICY council_sessions_select ON council_sessions
  FOR SELECT
  USING (
    -- Tenant rows: see only your own.
    -- Legacy anonymous rows: still readable for backwards compat.
    tenant_id = auth_tenant_id()
    OR tenant_id IS NULL
  );

CREATE POLICY council_sessions_insert ON council_sessions
  FOR INSERT
  WITH CHECK (
    -- New rows MUST bind to the JWT tenant.  No anonymous inserts.
    tenant_id IS NOT NULL
    AND tenant_id = auth_tenant_id()
  );

CREATE POLICY council_sessions_update ON council_sessions
  FOR UPDATE
  USING (tenant_id = auth_tenant_id())
  WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY council_sessions_delete ON council_sessions
  FOR DELETE
  USING (tenant_id = auth_tenant_id());

-- ---------------------------------------------------------------------------
-- council_turns: enable RLS + scope via the parent session
-- ---------------------------------------------------------------------------
ALTER TABLE council_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS council_turns_select ON council_turns;
DROP POLICY IF EXISTS council_turns_insert ON council_turns;

CREATE POLICY council_turns_select ON council_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM council_sessions s
      WHERE s.session_id = council_turns.session_id
        AND (s.tenant_id = auth_tenant_id() OR s.tenant_id IS NULL)
    )
  );

CREATE POLICY council_turns_insert ON council_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM council_sessions s
      WHERE s.session_id = council_turns.session_id
        AND s.tenant_id = auth_tenant_id()
    )
  );

-- council_turns has no UPDATE/DELETE in the application layer; ON DELETE
-- CASCADE from council_sessions handles row removal.  No policy needed.

-- ---------------------------------------------------------------------------
-- Index: support `WHERE tenant_id = :tenant_id ORDER BY updated_at DESC`
-- (the listSessions query under RLS).  Existing
-- council_sessions_tenant_idx is a partial index; this composite covers the
-- full list scan path.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS council_sessions_tenant_updated_idx
  ON council_sessions(tenant_id, updated_at DESC)
  WHERE tenant_id IS NOT NULL;

COMMENT ON POLICY council_sessions_insert ON council_sessions IS
  'Plan §1.4 — every new LLM Council session row must bind to the JWT tenant; '
  'no anonymous inserts are accepted by the API surface.';
