declare namespace Express {
  interface RequestUser {
    _id:                  string;
    email:                string;
    fullName:             string;
    phone?:               string;
    role:                 string;
    roles:                string[];
    directPermissions:    string[];
    status:               string;
    emailVerified:        boolean;
    effectivePermissions: string[];
  }

  interface Request {
    user?:      RequestUser;
    requestId?: string;
  }
}
