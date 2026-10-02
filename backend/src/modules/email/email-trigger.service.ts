import { EmailTriggerConfigModel, type IEmailTriggerConfig } from "./email-trigger-config.schema";
import { EmailService } from "./email.service";
import { logger } from "@/common/utils/logger";

export interface EmailTriggerContext {
  customer?:    { email: string; fullName: string };
  refId?:       string;  // orderNumber, prescriptionId, etc.
  status?:      string;
  extra?:       Record<string, unknown>;
}

export class EmailTriggerService {
  /**
   * Look up the trigger config for this module+transition.
   * fromStatus=null matches rows where fromStatus is null (initial state triggers).
   */
  static async resolve(
    module: string,
    fromStatus: string | null,
    toStatus: string,
  ): Promise<IEmailTriggerConfig | null> {
    // Priority 1: exact fromStatus match (also handles null initial-state rows)
    const exact = await EmailTriggerConfigModel.findOne({
      module, fromStatus, toStatus, enabled: true,
    }).lean() as IEmailTriggerConfig | null;
    if (exact) return exact;

    // Priority 2: wildcard rows — only relevant for named transitions
    if (fromStatus !== null) {
      return EmailTriggerConfigModel.findOne({
        module,
        fromStatus: { $in: [null, "*"] },
        toStatus,
        enabled: true,
      }).lean() as Promise<IEmailTriggerConfig | null>;
    }

    return null;
  }

  /**
   * Resolve config and fire the email if enabled.
   * Always fire-and-forget from the calling service — never await this directly.
   */
  static async fire(
    module: string,
    fromStatus: string | null,
    toStatus: string,
    ctx: EmailTriggerContext,
  ): Promise<void> {
    try {
      const config = await this.resolve(module, fromStatus, toStatus);
      if (!config) return;

      if (config.recipientTypes.includes("customer") && ctx.customer) {
        await EmailService.sendTransactionalEmail({
          to:          ctx.customer.email,
          fullName:    ctx.customer.fullName,
          templateKey: config.templateKey,
          module,
          fromStatus:  fromStatus ?? "",
          toStatus,
          refId:       ctx.refId ?? "",
          extra:       ctx.extra ?? {},
        });
      }
      // future: assigned_staff, admin_team recipient resolution
    } catch (err) {
      logger.error(`[EmailTrigger] ${module} ${fromStatus}→${toStatus} failed`, err);
    }
  }

  /* ── Admin CRUD ── */

  static async list(module?: string): Promise<IEmailTriggerConfig[]> {
    const query = module ? { module } : {};
    return EmailTriggerConfigModel.find(query).sort({ module: 1, toStatus: 1 }).lean() as unknown as Promise<IEmailTriggerConfig[]>;
  }

  static async update(
    id: string,
    patch: { enabled?: boolean; recipientTypes?: string[] },
    updatedBy: string,
  ): Promise<IEmailTriggerConfig | null> {
    return EmailTriggerConfigModel.findByIdAndUpdate(
      id,
      { ...patch, updatedBy },
      { new: true },
    ).lean() as Promise<IEmailTriggerConfig | null>;
  }
}
