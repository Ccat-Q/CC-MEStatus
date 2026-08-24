import {
  DEFAULT_LIMITS,
  type AgentCommand,
  type AuditEntry,
  type DevicePolicy,
  type Direction,
  type NetworkStatus,
  type ResourceKind
} from "@cc-mestatus/protocol";
import type { Env } from "./env";
import { MeSession } from "./session";
import { authorizeCommand, CommandValidationError, validateCommand } from "./validation";

export { MeSession };

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function session(env: Env): DurableObjectStub {
  return env.ME_SESSION.get(env.ME_SESSION.idFromName("primary"));
}

function actorFromAccess(request: Request, env: Env): string | Response {
  if (env.DEV_BYPASS_ACCESS === "true") return "local-development";
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return json({ error: "Cloudflare Access authentication required" }, 401);
  if (env.ACCESS_ALLOWED_EMAIL && email.toLowerCase() !== env.ACCESS_ALLOWED_EMAIL.toLowerCase()) {
    return json({ error: "This identity is not authorized" }, 403);
  }
  return email;
}

async function getLimits(env: Env): Promise<Record<ResourceKind, number>> {
  const rows = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('item_limit','fluid_limit','gas_limit')").all<{ key: string; value: string }>();
  const limits = { ...DEFAULT_LIMITS };
  for (const row of rows.results) {
    const resource = row.key.replace("_limit", "") as ResourceKind;
    const value = Number(row.value);
    if (Number.isSafeInteger(value) && value > 0) limits[resource] = value;
  }
  return limits;
}

function rowToPolicy(row: Record<string, unknown>): DevicePolicy {
  return {
    name: String(row.name),
    favorite: Boolean(row.favorite),
    favoriteOrder: Number(row.favorite_order),
    writable: Boolean(row.writable),
    direction: (row.direction as Direction | null) ?? null,
    itemLimit: row.item_limit == null ? null : Number(row.item_limit),
    fluidLimit: row.fluid_limit == null ? null : Number(row.fluid_limit),
    gasLimit: row.gas_limit == null ? null : Number(row.gas_limit),
    updatedAt: Number(row.updated_at)
  };
}

async function getPolicy(env: Env, name?: string): Promise<DevicePolicy | null> {
  if (!name) return null;
  const row = await env.DB.prepare("SELECT * FROM device_policies WHERE name = ?").bind(name).first<Record<string, unknown>>();
  return row ? rowToPolicy(row) : null;
}

async function logAudit(env: Env, actor: string, command: AgentCommand, success: boolean, error: string | null): Promise<void> {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action: command.action,
    resource: command.resource,
    subject: command.filter?.name ?? null,
    amount: command.filter?.amount ?? null,
    target: command.target ?? null,
    success,
    error,
    actor
  };
  await env.DB.prepare(
    "INSERT INTO audit_log(id,timestamp,action,resource,subject,amount,target,success,error,actor) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).bind(entry.id, entry.timestamp, entry.action, entry.resource, entry.subject, entry.amount, entry.target, entry.success ? 1 : 0, entry.error, entry.actor).run();
}

async function internalFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return session(env).fetch(new Request(`https://session.internal${path}`, init));
}

async function handleApi(request: Request, env: Env, actor: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/status" && request.method === "GET") {
    return internalFetch(env, "/status");
  }

  if (url.pathname === "/api/inventory" && request.method === "GET") {
    const resource = (url.searchParams.get("resource") ?? "item") as ResourceKind;
    const command: AgentCommand = { action: "refresh", resource };
    validateCommand(command);
    return internalFetch(env, "/command", { method: "POST", body: JSON.stringify(command) });
  }

  if (url.pathname === "/api/commands/prepare" && request.method === "POST") {
    const requested = await request.json<AgentCommand>();
    const policy = await getPolicy(env, requested.target);
    const command = authorizeCommand(requested, await getLimits(env), policy);
    return internalFetch(env, "/prepare", { method: "POST", body: JSON.stringify(command) });
  }

  if (url.pathname === "/api/commands/execute" && request.method === "POST") {
    const body = await request.json<{ token: string }>();
    const response = await internalFetch(env, "/execute", { method: "POST", body: JSON.stringify(body) });
    const payload = await response.clone().json<{ command?: AgentCommand; result?: unknown; error?: string }>();
    if (payload.command) {
      try {
        await logAudit(env, actor, payload.command, response.ok, payload.error ?? null);
      } catch (error) {
        console.error("The command completed but its audit record could not be stored", error);
      }
    }
    return response;
  }

  if (url.pathname === "/api/devices" && request.method === "GET") {
    const [statusResponse, policiesResult] = await Promise.all([
      internalFetch(env, "/status"),
      env.DB.prepare("SELECT * FROM device_policies ORDER BY favorite DESC, favorite_order ASC, name ASC").all<Record<string, unknown>>()
    ]);
    const status = await statusResponse.json<NetworkStatus>();
    return json({ devices: status.devices, policies: policiesResult.results.map(rowToPolicy) });
  }

  const deviceMatch = url.pathname.match(/^\/api\/devices\/(.+)$/);
  if (deviceMatch && request.method === "PUT") {
    const name = decodeURIComponent(deviceMatch[1] ?? "");
    const body = await request.json<Partial<DevicePolicy>>();
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO device_policies(name,favorite,favorite_order,writable,direction,item_limit,fluid_limit,gas_limit,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET favorite=excluded.favorite,favorite_order=excluded.favorite_order,
      writable=excluded.writable,direction=excluded.direction,item_limit=excluded.item_limit,
      fluid_limit=excluded.fluid_limit,gas_limit=excluded.gas_limit,updated_at=excluded.updated_at
    `).bind(
      name, body.favorite ? 1 : 0, body.favoriteOrder ?? 0, body.writable ? 1 : 0,
      body.direction ?? null, body.itemLimit ?? null, body.fluidLimit ?? null, body.gasLimit ?? null, now
    ).run();
    return json(await getPolicy(env, name));
  }

  if (url.pathname === "/api/audit" && request.method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100").all<Record<string, unknown>>();
    return json(rows.results.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      subject: row.subject,
      amount: row.amount,
      target: row.target,
      success: Boolean(row.success),
      error: row.error,
      actor: row.actor
    })));
  }

  if (url.pathname === "/api/settings" && request.method === "GET") {
    return json({ limits: await getLimits(env) });
  }

  if (url.pathname === "/api/settings" && request.method === "PUT") {
    const body = await request.json<{ limits: Record<ResourceKind, number> }>();
    for (const resource of ["item", "fluid", "gas"] as ResourceKind[]) {
      const value = body.limits[resource];
      if (!Number.isSafeInteger(value) || value < 1) return json({ error: `Invalid ${resource} limit` }, 400);
      await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
        .bind(`${resource}_limit`, String(value), Date.now()).run();
    }
    return json({ limits: await getLimits(env) });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/agent/ws") {
        const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        if (!env.AGENT_TOKEN || token !== env.AGENT_TOKEN) return new Response("Unauthorized", { status: 401 });
        return session(env).fetch(new Request("https://session.internal/agent", request));
      }

      if (url.pathname.startsWith("/agent/")) return env.ASSETS.fetch(request);

      const actor = actorFromAccess(request, env);
      if (actor instanceof Response) return actor;
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, actor);
      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = error instanceof CommandValidationError ? 400 : 500;
      return json({ error: error instanceof Error ? error.message : "Unexpected error" }, status);
    }
  }
} satisfies ExportedHandler<Env>;
