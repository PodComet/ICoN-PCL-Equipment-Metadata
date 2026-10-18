declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SITES_LOCAL_ADMIN?: string;
  }
}
