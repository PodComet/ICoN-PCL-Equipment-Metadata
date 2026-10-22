declare namespace Cloudflare {
  interface Env {
    ASSETS?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITES_LOCAL_ADMIN?: string;
    CATALOG_ADMIN_PASSWORD_HASH?: string;
    CATALOG_ADMIN_SESSION_KEY?: string;
  }
}
