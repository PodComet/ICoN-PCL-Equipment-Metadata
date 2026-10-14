import type { ChatGPTUser } from "./chatgpt-auth";

// Temporary policy: every authenticated site user is an administrator.
// Replace this one function with role/allowlist checks when access is gated.
export function isCatalogAdmin(user: ChatGPTUser | null): boolean {
  return !!user;
}
