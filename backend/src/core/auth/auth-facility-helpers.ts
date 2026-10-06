// Facility-scoped auth helpers. These receive a TenantTransaction (app_user pool,
// RLS enforced) from the calling service — they do NOT import db or superAdminDb.
import { eq, and } from 'drizzle-orm';
import { TenantTransaction } from '@/db';
import { facilityRoles, facilityUsers } from '@/db/schema/rbac';

export async function createFacilityPatientRole(
  tx: TenantTransaction,
  facilityId: string,
): Promise<{ id: string }> {
  await tx
    .insert(facilityRoles)
    .values({ facilityId, name: 'patient', isSystemRole: true })
    .onConflictDoNothing();

  const [role] = await tx
    .select({ id: facilityRoles.id })
    .from(facilityRoles)
    .where(and(eq(facilityRoles.facilityId, facilityId), eq(facilityRoles.name, 'patient')))
    .limit(1);

  if (!role) throw new Error('createFacilityPatientRole: role not found after upsert');
  return { id: role.id };
}

export async function createFacilityUserLink(
  tx: TenantTransaction,
  data: { facilityId: string; userId: string; roleId: string },
): Promise<void> {
  await tx
    .insert(facilityUsers)
    .values({
      facilityId: data.facilityId,
      userId: data.userId,
      roleId: data.roleId,
    })
    .onConflictDoNothing();
}
