// Stable owner ID preserves plans created before the local account was renamed.
export const LOCAL_ADMIN_ID = 'local_seedy';
export const LOCAL_ADMIN_EMAIL = 'admin@localhost';
export const LOCAL_ADMIN_NAME = 'admin';
export function localAdminEnabled(command: string, managedLinux: boolean, setting?: string): boolean {
  return command === 'serve' && !managedLinux && setting !== '0';
}
export function isLocalAdmin(user: {userId: string; email: string} | null, bindings: {SITES_LOCAL_ADMIN?: string}): boolean {
  return bindings.SITES_LOCAL_ADMIN === 'enabled' && user?.userId === LOCAL_ADMIN_ID && user.email === LOCAL_ADMIN_EMAIL;
}
