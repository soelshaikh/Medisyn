import { AppError } from '@/lib/errors';

export type ConversationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SenderType = 'patient' | 'staff';

export const CONVERSATION_VALID_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  open:        ['in_progress', 'resolved', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved:    [],
  closed:      [],
};

export function validateConversationTransition(
  current: ConversationStatus,
  next: ConversationStatus,
): void {
  const allowed = CONVERSATION_VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new AppError(
      'HEALTHCARE_INVALID_STATUS_TRANSITION',
      `Cannot transition conversation from '${current}' to '${next}'`,
      422,
    );
  }
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderName: string;
  body: string;
  createdAt: Date;
}

export interface PatientConversationSummary {
  id: string;
  subject: string;
  medicationName: string | null;
  status: ConversationStatus;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

// internalNotes and assignedToName intentionally absent — never exposed to patients
export interface PatientConversationDetail extends PatientConversationSummary {
  messages: ConversationMessage[];
}

export interface AdminConversationDetail extends PatientConversationDetail {
  internalNotes: string | null;
  patientId: string;
  patientName: string;
  patientEmail: string;
  assignedToId: string | null;
  assignedToName: string | null;
}
