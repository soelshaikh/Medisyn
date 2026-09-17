declare namespace Express {
  interface Request {
    user?: {
      _id:                  string;
      email:                string;
      fullName:             string;
      phone?:               string;
      role:                 string;
      roles:                unknown[];
      directPermissions:    string[];
      status:               string;
      emailVerified:        boolean;
      effectivePermissions: string[];
    };
    requestId?: string;
  }
}
