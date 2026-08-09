export interface AuthUser {
  id: number;
  email: string;
  name: string;
  system_role: 'admin' | 'member';
  account_status: 'active' | 'inactive';
  project_roles?: Array<{
    project_id: number;
    project_role: 'manager' | 'contributor' | 'viewer';
  }>;
}

export interface JWTPayload {
  userId: number;
  email: string;
  systemRole: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    system_role: string;
    project_roles: Array<{
      project_id: number;
      project_name: string;
      project_role: string;
    }>;
  };
}
