import type { IUser } from "@/modules/users/users.schema";

declare global {
  namespace Express {
    interface Request {
      user?: IUser & { _id: string; effectivePermissions: string[] };
      requestId?: string;
    }
  }
}
