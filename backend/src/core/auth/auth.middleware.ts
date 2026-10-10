import { parseJWT } from './middleware/parse-jwt';
import { checkSession } from './middleware/check-session';
import { verifyAuthVersion } from './middleware/verify-auth-version';
import { checkFacilityStatus } from './middleware/check-facility-status';
import { requireModule } from './middleware/require-module';
import { requirePermission } from './middleware/require-permission';

export const authMiddleware = [
  parseJWT,
  checkSession,
  verifyAuthVersion,
  checkFacilityStatus,
];

export { requireModule, requirePermission };
