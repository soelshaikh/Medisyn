import { z } from 'zod';
import { TenantTransaction, SuperAdminTransaction } from '@/db';
import { auditLog } from '@/db/schema/audit';

// Audit action format: {domain}.{event}
// e.g. auth.login, session.revoke, rbac.role_change, super_admin.cross_facility_read
const actionSchema = z.string().regex(/^[a-z_]+\.[a-z_]+$/, {
  message: 'Audit action must match pattern {domain}.{event}',
});

export interface AuditEntryParams {
  facilityId?: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'api_key';
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// createAuditEntry — the ONLY way audit records are written.
// Accepts either a regular tenant transaction or a super admin transaction.
export async function createAuditEntry(
  params: AuditEntryParams,
  tx: TenantTransaction | SuperAdminTransaction,
): Promise<void> {
  // Validate action format
  actionSchema.parse(params.action);

  await (tx as TenantTransaction).insert(auditLog).values({
    facilityId: params.facilityId ?? null,
    actorId: params.actorId ?? null,
    actorType: params.actorType,
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    metadata: params.metadata ?? {},
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}
