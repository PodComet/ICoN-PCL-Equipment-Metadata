import type { ChatGPTUser } from "./chatgpt-auth";
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {ADMIN_COOKIE,verifyAdminSession,type AdminSecrets} from './admin-session';
import {isLocalAdmin} from './local-admin';

// Hosted administration requires a verified password session. The dev binding is
// supplied only by the loopback preview, never by a production build.
export async function isCatalogAdmin(user: ChatGPTUser | null): Promise<boolean> {
  if(!user)return false;
  if(isLocalAdmin(user,env))return true;
  const jar=await cookies();
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value,user.userId,env as AdminSecrets);
}
