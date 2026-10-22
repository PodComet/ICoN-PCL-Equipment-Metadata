// A password-only login uses a separate shared workspace. Existing account-owned
// workflows and research records keep their original owners and access rules.
export const PASSWORD_ADMIN_ID = 'iconpcl_shared_password_admin_v1';
export const PASSWORD_ADMIN_USER = {
  userId: PASSWORD_ADMIN_ID,
  displayName: 'admin',
  email: 'admin@password.invalid',
  fullName: 'admin',
};
