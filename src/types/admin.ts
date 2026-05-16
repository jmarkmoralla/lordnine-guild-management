export type ManagedAdminRole = 'admin' | 'super_admin';

export type AppRole = 'guest' | ManagedAdminRole;

export interface ManagedAdmin {
  uid: string;
  email: string;
  displayName: string;
  role: ManagedAdminRole;
  enabled: boolean;
  authDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}