"use client";

import { Badge } from "@/components/ui/Badge";
import type { ComponentProps } from "react";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  /* User statuses */
  active:               { label: "Active",            variant: "success" },
  pending_verification: { label: "Pending Verify",    variant: "warning" },
  pending_approval:     { label: "Pending Approval",  variant: "warning" },
  suspended:            { label: "Suspended",          variant: "error"   },
  deactivated:          { label: "Deactivated",        variant: "default" },
  rejected:             { label: "Rejected",           variant: "error"   },

  /* Request/order statuses */
  submitted:            { label: "Submitted",          variant: "info"    },
  received:             { label: "Received",           variant: "info"    },
  under_review:         { label: "Under Review",       variant: "warning" },
  processing:           { label: "Processing",         variant: "primary" },
  completed:            { label: "Completed",          variant: "success" },
  declined:             { label: "Declined",           variant: "error"   },
  cancelled:            { label: "Cancelled",          variant: "default" },

  /* Order statuses */
  pending:              { label: "Pending",            variant: "warning" },
  confirmed:            { label: "Confirmed",          variant: "primary" },
  ready_for_dispatch:   { label: "Ready to Dispatch",  variant: "primary" },
  shipped:              { label: "Shipped",            variant: "info"    },
  delivered:            { label: "Delivered",          variant: "success" },
  refunded:             { label: "Refunded",           variant: "default" },

  /* Appointment statuses */
  no_show:              { label: "No Show",            variant: "error"   },
};

interface StatusBadgeProps {
  status: string;
  size?: ComponentProps<typeof Badge>["size"];
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const mapped = statusMap[status.toLowerCase()] ?? {
    label: status,
    variant: "default" as BadgeVariant,
  };

  return <Badge variant={mapped.variant} size={size}>{mapped.label}</Badge>;
}
