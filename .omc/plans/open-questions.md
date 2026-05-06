# Open Questions

## auth-multitenant-jwt-rls - 2026-05-03
- [ ] Tenant deletion cascade vs. soft-delete policy — affects Phase 6 migration semantics for orphaned collections.
- [ ] Refresh-token rotation strategy — sliding (refresh-on-use, better UX) vs. fixed 7-day window (simpler, easier audit).
- [ ] JWT key rotation cadence — quarterly proposed but not confirmed; need security review sign-off.
- [ ] Should `tenant_invites` use email or invite-link-only? Affects whether email infra is in scope.
- [ ] Canary tenant CI test — run on every PR or nightly only? Latency impact on PR feedback loop.
