import { v4 as uuidv4 } from 'uuid';
import { getSuperAdminTestDb } from './db';
import * as healthcareSchema from '@/db/schema/healthcare';

// ── Prescription fixtures ─────────────────────────────────────────────────

export async function createTestPrescriptionRequest(
  facilityId: string,
  patientId: string,
  overrides: Partial<typeof healthcareSchema.prescriptionRequests.$inferInsert> = {},
): Promise<typeof healthcareSchema.prescriptionRequests.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(healthcareSchema.prescriptionRequests)
    .values({
      facilityId,
      patientId,
      type: overrides.type ?? 'refill',
      medicationName: overrides.medicationName ?? 'Test Medication',
      status: overrides.status ?? 'submitted',
      dosage: overrides.dosage,
      prescriberName: overrides.prescriberName,
      prescriberFax: overrides.prescriberFax,
      fileReference: overrides.fileReference,
      dispenseNotes: overrides.dispenseNotes,
      internalNotes: overrides.internalNotes,
    })
    .returning();

  await sa.insert(healthcareSchema.prescriptionRequestHistory).values({
    requestId: row.id,
    facilityId,
    previousStatus: null,
    newStatus: row.status,
    changedById: null,
    note: null,
  });

  return row;
}

// ── Compounding fixtures ──────────────────────────────────────────────────

export async function createTestCompoundingRequest(
  facilityId: string,
  patientId: string,
  overrides: Partial<typeof healthcareSchema.compoundingRequests.$inferInsert> = {},
): Promise<typeof healthcareSchema.compoundingRequests.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(healthcareSchema.compoundingRequests)
    .values({
      facilityId,
      patientId,
      compoundName: overrides.compoundName ?? 'Test Compound',
      form: overrides.form ?? 'cream',
      quantity: overrides.quantity ?? '60g',
      status: overrides.status ?? 'submitted',
      strength: overrides.strength,
      specialInstructions: overrides.specialInstructions,
      prescriberName: overrides.prescriberName,
      fileReference: overrides.fileReference,
      quotedPrice: overrides.quotedPrice,
      quotedTurnaroundDays: overrides.quotedTurnaroundDays,
      internalNotes: overrides.internalNotes,
    })
    .returning();

  await sa.insert(healthcareSchema.compoundingRequestHistory).values({
    requestId: row.id,
    facilityId,
    previousStatus: null,
    newStatus: row.status,
    changedById: null,
    note: null,
  });

  return row;
}

// ── Minor ailment fixtures ────────────────────────────────────────────────

export async function createTestMinorAilmentCatalogEntry(
  facilityId: string,
  overrides: Partial<typeof healthcareSchema.minorAilmentCatalog.$inferInsert> = {},
): Promise<typeof healthcareSchema.minorAilmentCatalog.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(healthcareSchema.minorAilmentCatalog)
    .values({
      facilityId,
      name: overrides.name ?? `Test-Ailment-${uuidv4().slice(0, 8)}`,
      description: overrides.description,
      isActive: overrides.isActive ?? true,
      displayOrder: overrides.displayOrder ?? 0,
    })
    .returning();
  return row;
}

export async function createTestMinorAilmentRequest(
  facilityId: string,
  patientId: string,
  ailmentId: string,
  overrides: Partial<typeof healthcareSchema.minorAilmentRequests.$inferInsert> = {},
): Promise<typeof healthcareSchema.minorAilmentRequests.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(healthcareSchema.minorAilmentRequests)
    .values({
      facilityId,
      patientId,
      ailmentId,
      symptoms: overrides.symptoms ?? 'Test symptoms for testing purposes',
      duration: overrides.duration ?? '3 days',
      status: overrides.status ?? 'submitted',
      currentMedications: overrides.currentMedications,
      healthHistory: overrides.healthHistory,
      treatmentNote: overrides.treatmentNote,
      internalNotes: overrides.internalNotes,
    })
    .returning();

  await sa.insert(healthcareSchema.minorAilmentRequestHistory).values({
    requestId: row.id,
    facilityId,
    previousStatus: null,
    newStatus: row.status,
    changedById: null,
    note: null,
  });

  return row;
}

// ── Ask-a-Pharmacist fixtures ─────────────────────────────────────────────

export async function createTestConversation(
  facilityId: string,
  patientId: string,
  overrides: Partial<typeof healthcareSchema.pharmacistConversations.$inferInsert> & {
    firstMessageBody?: string;
  } = {},
): Promise<typeof healthcareSchema.pharmacistConversations.$inferSelect> {
  const sa = getSuperAdminTestDb();
  const [row] = await sa
    .insert(healthcareSchema.pharmacistConversations)
    .values({
      facilityId,
      patientId,
      subject: overrides.subject ?? 'Test Question',
      medicationName: overrides.medicationName,
      assignedTo: overrides.assignedTo,
      status: overrides.status ?? 'open',
      internalNotes: overrides.internalNotes,
    })
    .returning();

  await sa.insert(healthcareSchema.conversationMessages).values({
    conversationId: row.id,
    facilityId,
    senderId: patientId,
    senderType: 'patient',
    body: overrides.firstMessageBody ?? 'Test question body for testing purposes.',
  });

  return row;
}

// ── Cleanup helpers ───────────────────────────────────────────────────────

export async function deleteTestHealthcareByFacility(facilityId: string): Promise<void> {
  const sa = getSuperAdminTestDb();
  const { eq } = await import('drizzle-orm');

  // Delete conversation messages (FK → conversations)
  const convs = await sa
    .select({ id: healthcareSchema.pharmacistConversations.id })
    .from(healthcareSchema.pharmacistConversations)
    .where(eq(healthcareSchema.pharmacistConversations.facilityId, facilityId));
  for (const conv of convs) {
    await sa
      .delete(healthcareSchema.conversationMessages)
      .where(eq(healthcareSchema.conversationMessages.conversationId, conv.id));
  }

  // Delete conversations
  await sa
    .delete(healthcareSchema.pharmacistConversations)
    .where(eq(healthcareSchema.pharmacistConversations.facilityId, facilityId));

  // Delete minor ailment request history then requests
  const ailmentReqs = await sa
    .select({ id: healthcareSchema.minorAilmentRequests.id })
    .from(healthcareSchema.minorAilmentRequests)
    .where(eq(healthcareSchema.minorAilmentRequests.facilityId, facilityId));
  for (const req of ailmentReqs) {
    await sa
      .delete(healthcareSchema.minorAilmentRequestHistory)
      .where(eq(healthcareSchema.minorAilmentRequestHistory.requestId, req.id));
  }
  await sa
    .delete(healthcareSchema.minorAilmentRequests)
    .where(eq(healthcareSchema.minorAilmentRequests.facilityId, facilityId));

  // Delete ailment catalog
  await sa
    .delete(healthcareSchema.minorAilmentCatalog)
    .where(eq(healthcareSchema.minorAilmentCatalog.facilityId, facilityId));

  // Delete compounding history then requests
  const compReqs = await sa
    .select({ id: healthcareSchema.compoundingRequests.id })
    .from(healthcareSchema.compoundingRequests)
    .where(eq(healthcareSchema.compoundingRequests.facilityId, facilityId));
  for (const req of compReqs) {
    await sa
      .delete(healthcareSchema.compoundingRequestHistory)
      .where(eq(healthcareSchema.compoundingRequestHistory.requestId, req.id));
  }
  await sa
    .delete(healthcareSchema.compoundingRequests)
    .where(eq(healthcareSchema.compoundingRequests.facilityId, facilityId));

  // Delete prescription history then requests
  const rxReqs = await sa
    .select({ id: healthcareSchema.prescriptionRequests.id })
    .from(healthcareSchema.prescriptionRequests)
    .where(eq(healthcareSchema.prescriptionRequests.facilityId, facilityId));
  for (const req of rxReqs) {
    await sa
      .delete(healthcareSchema.prescriptionRequestHistory)
      .where(eq(healthcareSchema.prescriptionRequestHistory.requestId, req.id));
  }
  await sa
    .delete(healthcareSchema.prescriptionRequests)
    .where(eq(healthcareSchema.prescriptionRequests.facilityId, facilityId));
}
