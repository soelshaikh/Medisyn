// Re-exports session revocation functions from the super-admin service layer.
// These functions use superAdminDb internally (BYPASSRLS) to operate across
// all facility sessions without tenant context.
export {
  revokeSession,
  revokeAllUserSessions,
  revokeAllFacilitySessions,
} from '@/core/super-admin/auth-queries.service';
