# Launch iconpcl.podcomet.ai

Prepared 2026-10-17. The custom hostname has been registered with Sites. DNS verification and HTTPS are pending. Registering the hostname does not change the private site's audience.

## 1. Review the prepared site

Open the existing hosted site and select **Admin access**. Sign in, enter the password provided separately by the project owner, and select **Unlock administration**. Shared CSV administration, the shared new-machine form and private Purdue inventory require this additional session. Use **Lock admin** to remove administrator access from the browser. Sessions expire after eight hours.

The password is not in this document, GitHub, HTML or browser JavaScript. Production stores a salted password verifier and a separate session-signing secret. Unlock attempts are limited to five per 15-minute window per signed-in account and, when available, client IP. Changing either secret invalidates existing administrator cookies. A shared password grants admin access to anyone who knows it and signs in; individual curator accounts/roles can replace it later.

## 2. Open Cloudflare DNS

1. Sign in to the Cloudflare account that manages **podcomet.ai**.
2. Select **podcomet.ai**.
3. Open **DNS → Records → Add record**.

You are adding a subdomain under an existing domain. Keep the existing root, website and mail records.

## 3. Add these exact records

Cloudflare's **Name** fields below are relative to `podcomet.ai`. Set TTL to **Auto**. Use **DNS only** for the CNAME during validation.

| Type | Name | Content / target |
| --- | --- | --- |
| CNAME | `iconpcl` | `custom-domains.chatgpt.site` |
| TXT | `_openai-site-verification.iconpcl` | `openai-site-verification=xh0dpTlivYaw_md29-lIyRDegfAPD7Id-GkPl8rvXXo` |
| TXT | `_cf-custom-hostname.iconpcl` | `4060d964-4b9e-4c20-9bae-0fe72041db8f` |

Save each record. The TXT values are public ownership-verification records, not the administrator password. These values came from the custom-domain registration for this exact Site; do not substitute another Site's values.

If a record with one of these exact names already exists, inspect it before changing it. If the hosting service later returns additional certificate-validation records, add those exact records too.

[Cloudflare's DNS record instructions](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)

## 4. Verify the address and HTTPS

After saving the records, have Sites recheck the existing domain registration. Wait for domain routing and SSL to report **active**. Then visit `https://iconpcl.podcomet.ai`. While the Site remains private, a sign-in/access screen is expected. DNS and HTTPS completion do not by themselves make the application public.

## 5. Review the research information

Review [the public research information draft](public-research-information-draft.md), including institutional roles, contributor credit, citation and data licensing. The people named in institutional announcements have not automatically been assigned software authorship.

## 6. Open public browsing

Once the prepared version, DNS and HTTPS are checked, change this Site's audience to **Public**. This is the go-live step. It allows anonymous visitors to browse; the application-level administrator gate continues to protect shared updates and private inventory.

Check the new address in a private/incognito browser window: catalog search and references should load, the inventory should be absent, and CSV administration should remain locked. Check an ordinary signed-in account too. Unlock administration and confirm the inventory/CSV controls appear, then lock it and confirm they disappear. Confirm sign-in and workflow saving on the custom hostname.

## 7. Record the launch

Export the shared curated catalog for review, preserve the prior working deployment and a database backup, tag the reviewed GitHub release, and record the release/commit in the site's research information. Archive a numbered research release and finalize its citation when contributor metadata is confirmed.
