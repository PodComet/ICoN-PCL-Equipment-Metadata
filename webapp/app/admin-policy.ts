import type { ChatGPTUser } from "./chatgpt-auth";
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {ADMIN_COOKIE,verifyAdminSession,type AdminSecrets} from './admin-session';

// Sign-in establishes identity. Only a verified password session grants admin access.
export async function isCatalogAdmin(user: ChatGPTUser | null): Promise<boolean> {
  if(!user)return false;
  const jar=await cookies();
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value,user.userId,env as AdminSecrets);
}
