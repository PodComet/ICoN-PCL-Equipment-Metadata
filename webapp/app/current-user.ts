import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {getChatGPTUser, type ChatGPTUser} from './chatgpt-auth';
import {ADMIN_COOKIE, verifyAdminSession, type AdminSecrets} from './admin-session';
import {PASSWORD_ADMIN_ID, PASSWORD_ADMIN_USER} from './password-identity';

export async function getCurrentUser(): Promise<ChatGPTUser | null> {
  const jar = await cookies();
  if (await verifyAdminSession(jar.get(ADMIN_COOKIE)?.value, PASSWORD_ADMIN_ID, env as AdminSecrets)) {
    return PASSWORD_ADMIN_USER;
  }
  return getChatGPTUser();
}
