import test from 'node:test';
import assert from 'node:assert/strict';
import {adminConfigured,passwordHash,verifyPassword,issueAdminSession,verifyAdminSession,adminCookie,adminRateKey,ADMIN_SESSION_SECONDS} from '../app/admin-session.ts';
const secrets={CATALOG_ADMIN_PASSWORD_HASH:await passwordHash('example-test-passphrase','0123456789abcdef0123456789abcdef'),CATALOG_ADMIN_SESSION_KEY:'ab'.repeat(32)};
test('administration fails closed without complete server secrets',async()=>{
 assert.equal(adminConfigured({}),false);assert.equal(await verifyPassword('example-test-passphrase',{}),false);assert.equal(await verifyAdminSession('abc','reader',{}),false);await assert.rejects(()=>issueAdminSession('reader',{}));
});
test('password verification rejects wrong values and handles Unicode',async()=>{
 assert.equal(await verifyPassword('example-test-passphrase',secrets),true);assert.equal(await verifyPassword('Example-test-passphrase',secrets),false);assert.equal(await verifyPassword('',secrets),false);
 const unicode={...secrets,CATALOG_ADMIN_PASSWORD_HASH:await passwordHash('équipment ✓','fedcba9876543210fedcba9876543210')};assert.equal(await verifyPassword('équipment ✓',unicode),true);
});
test('signed admin sessions are account-bound and expire after eight hours',async()=>{
 const token=await issueAdminSession('user-α',secrets,1000);assert.equal(await verifyAdminSession(token,'user-α',secrets,1000),true);assert.equal(await verifyAdminSession(token,'other-user',secrets,1000),false);assert.equal(await verifyAdminSession(token,undefined,secrets,1000),false);assert.equal(await verifyAdminSession(token,'user-α',secrets,999),false);assert.equal(await verifyAdminSession(token,'user-α',secrets,1000+ADMIN_SESSION_SECONDS),false);
});
test('tampering and password or signing-key rotation invalidate sessions',async()=>{
 const token=await issueAdminSession('curator',secrets,1000);for(const bad of [token+'x',token+'.extra','not-a-token','x'.repeat(3000)])assert.equal(await verifyAdminSession(bad,'curator',secrets,1001),false);
 assert.equal(await verifyAdminSession(token,'curator',{...secrets,CATALOG_ADMIN_SESSION_KEY:'cd'.repeat(32)},1001),false);
 assert.equal(await verifyAdminSession(token,'curator',{...secrets,CATALOG_ADMIN_PASSWORD_HASH:await passwordHash('changed-test-password','0123456789abcdef0123456789abcdef')},1001),false);
});
test('session cookies are HttpOnly, secure, same-site and can be cleared',()=>{
 const cookie=adminCookie('signed-token');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=28800'])assert.ok(cookie.includes(flag));assert.ok(!cookie.includes('Domain='));assert.ok(adminCookie('').includes('Max-Age=0'));assert.ok(!adminCookie('local-token',false).includes('Secure'));
});
test('rate-limit keys conceal identities and differ across subjects',async()=>{
 const a=await adminRateKey('user:private@example.test',secrets),b=await adminRateKey('ip:192.0.2.1',secrets);assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.equal(a,await adminRateKey('user:private@example.test',secrets));
});
