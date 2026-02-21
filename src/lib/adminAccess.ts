export const ADMIN_EMAIL = 'admin719426@gmail.com';
export const ADMIN_PASSWORD = 'Muhmmad1';
export const ADMIN_SESSION_KEY = 'admin_access_verified';

export const isPrimaryAdminEmail = (email?: string | null) =>
  (email ?? '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

export const isPrimaryAdminCredential = (email: string, password: string) =>
  isPrimaryAdminEmail(email) && password === ADMIN_PASSWORD;
