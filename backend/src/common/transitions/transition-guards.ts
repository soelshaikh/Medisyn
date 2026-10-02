import { AppError } from "@/common/middleware/error.middleware";

interface TransitionRule {
  permission: string;
}

type ModuleTransitions = Record<string, Record<string, TransitionRule>>;

/**
 * Defines every valid from→to transition per module and which permission is required.
 * If a from→to pair is NOT listed, the transition is unconditionally rejected (400).
 * If it IS listed but the actor lacks the permission, it is rejected (403).
 */
const TRANSITION_GUARDS: Record<string, ModuleTransitions> = {
  orders: {
    pending: {
      confirmed:       { permission: "orders.status.confirm" },
      cancelled:       { permission: "orders.cancel" },
    },
    confirmed: {
      processing:      { permission: "orders.status.update" },
      cancelled:       { permission: "orders.cancel" },
    },
    processing: {
      ready_for_pickup: { permission: "orders.status.update" },
      cancelled:        { permission: "orders.cancel" },
    },
    ready_for_pickup: {
      delivered:       { permission: "orders.status.deliver" },
    },
  },

  prescriptions: {
    submitted: {
      received:        { permission: "prescriptions.status.update" },
      cancelled:       { permission: "prescriptions.status.update" },
    },
    received: {
      verified:        { permission: "prescriptions.status.verify" },   // pharmacist-only
      cancelled:       { permission: "prescriptions.status.update" },
    },
    verified: {
      dispensed:       { permission: "prescriptions.status.dispense" }, // pharmacist-only
      cancelled:       { permission: "prescriptions.status.update" },
    },
  },

  compounding: {
    submitted: {
      reviewing:       { permission: "compounding.status.update" },
      cancelled:       { permission: "compounding.status.update" },
    },
    reviewing: {
      quote_sent:      { permission: "compounding.status.update" },
      cancelled:       { permission: "compounding.status.update" },
    },
    quote_sent: {
      approved:        { permission: "compounding.status.approve" },    // pharmacist-only
      cancelled:       { permission: "compounding.status.update" },
    },
    approved: {
      in_production:   { permission: "compounding.status.update" },
      cancelled:       { permission: "compounding.status.update" },
    },
    in_production: {
      ready:           { permission: "compounding.status.complete" },   // pharmacist-only
      cancelled:       { permission: "compounding.status.update" },
    },
    ready: {
      delivered:       { permission: "compounding.status.complete" },   // pharmacist-only
    },
  },
};

export function guardTransition(
  module: string,
  fromStatus: string,
  toStatus: string,
  actorPermissions: Set<string>,
): void {
  const moduleGuards = TRANSITION_GUARDS[module];
  if (!moduleGuards) throw new AppError(`Unknown transition module: ${module}`, 500);

  const rule = moduleGuards[fromStatus]?.[toStatus];
  if (!rule) {
    throw new AppError(
      `Cannot move from "${fromStatus}" to "${toStatus}"`,
      400,
    );
  }
  if (!actorPermissions.has(rule.permission)) {
    throw new AppError(
      `You do not have permission to move this to "${toStatus}"`,
      403,
    );
  }
}
