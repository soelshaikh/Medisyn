// This is the ONLY file in the project that imports superAdminDb.
// ESLint enforces this: no-restricted-imports blocks superAdminDb import from
// any file outside src/core/super-admin/.

import { superAdminDb, SuperAdminTransaction } from '@/db';
import { createAuditEntry, AuditEntryParams } from '@/core/audit/audit.service';

type AuditParams = Omit<AuditEntryParams, 'actorType'> & { actorId: string };

// superAdminQuery — wrapper for all cross-facility super admin DB operations.
//
// Contract:
//   1. Writes a pre-execution audit entry BEFORE the data transaction opens.
//   2. Opens a transaction against superAdminDb (BYPASSRLS).
//   3. Invokes fn(tx).
//   4. If audit write fails, the operation does NOT proceed.

export async function superAdminQuery<T>(
  auditParams: AuditParams,
  fn: (tx: SuperAdminTransaction) => Promise<T>,
): Promise<T> {
  // Write audit record BEFORE the operation (pre-execution)
  await superAdminDb.transaction(async (auditTx) => {
    await createAuditEntry(
      {
        facilityId: auditParams.facilityId,
        actorId: auditParams.actorId,
        actorType: 'user',
        action: auditParams.action,
        resourceType: auditParams.resourceType,
        resourceId: auditParams.resourceId,
        metadata: auditParams.metadata,
        ipAddress: auditParams.ipAddress,
        userAgent: auditParams.userAgent,
      },
      auditTx as SuperAdminTransaction,
    );
  });

  // Execute the actual operation in a separate transaction
  return superAdminDb.transaction(fn);
}
