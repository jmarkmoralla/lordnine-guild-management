export type ManagedAdminRole = 'admin' | 'super_admin' | 'guild_admin';

export type AppRole = 'guest' | ManagedAdminRole;

export interface ManagedAdmin {
  uid: string;
  email: string;
  displayName: string;
  role: ManagedAdminRole;
  guild?: string;
  enabled: boolean;
  authDisabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}