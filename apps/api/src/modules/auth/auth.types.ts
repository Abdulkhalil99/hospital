export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface UserRow {
  id:                   string;
  username:             string;
  email:                string;
  password_hash:        string;
  full_name:            string;
  is_active:            boolean;
  is_locked:            boolean;
  locked_until:         Date | null;
  failed_attempts:      number;
  must_change_password: boolean;
  preferred_language:   string;
}

export interface RoleRow       { id: string; name: string }
export interface PermissionRow { code: string }
