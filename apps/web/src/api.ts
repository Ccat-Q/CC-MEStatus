import type {
  AgentCommand,
  AuditEntry,
  DevicePolicy,
  NetworkStatus,
  PeripheralDevice,
  PreparedCommand,
  ResourceKind
} from "@cc-mestatus/protocol";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (window.location.protocol === "file:") {
    throw new Error("当前页面是直接从文件打开的。请使用 http://localhost:5173、http://127.0.0.1:8787 或已部署的 Cloudflare 域名访问。");
  }
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers }
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export const api = {
  status: () => request<NetworkStatus>("/api/status"),
  inventory: (resource: ResourceKind) => request<{ result: { resources: unknown[]; status?: Partial<NetworkStatus>; devices?: PeripheralDevice[] } }>(`/api/inventory?resource=${resource}`),
  prepare: (command: AgentCommand) => request<PreparedCommand>("/api/commands/prepare", { method: "POST", body: JSON.stringify(command) }),
  execute: (token: string) => request<{ command: AgentCommand; result: unknown }>("/api/commands/execute", { method: "POST", body: JSON.stringify({ token }) }),
  devices: () => request<{ devices: PeripheralDevice[]; policies: DevicePolicy[] }>("/api/devices"),
  saveDevice: (name: string, policy: Partial<DevicePolicy>) => request<DevicePolicy>(`/api/devices/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify(policy) }),
  audit: () => request<AuditEntry[]>("/api/audit"),
  settings: () => request<{ limits: Record<ResourceKind, number> }>("/api/settings"),
  saveSettings: (limits: Record<ResourceKind, number>) => request<{ limits: Record<ResourceKind, number> }>("/api/settings", { method: "PUT", body: JSON.stringify({ limits }) })
};

