export interface Env {
  ME_SESSION: DurableObjectNamespace;
  DB: D1Database;
  ASSETS: Fetcher;
  AGENT_TOKEN: string;
  ACCESS_ALLOWED_EMAIL?: string;
  DEV_BYPASS_ACCESS?: string;
}

