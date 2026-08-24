import {
  WRITE_ACTIONS,
  type AgentCommand,
  type AgentHello,
  type AgentMessage,
  type AgentRequest,
  type AgentResponse,
  type NetworkStatus,
  type PreparedCommand
} from "@cc-mestatus/protocol";
import type { Env } from "./env";
import { commandSummary } from "./validation";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class MeSession implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private pending = new Map<string, PendingRequest>();
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/agent") return this.acceptAgent(request);
    if (url.pathname === "/status") return Response.json(await this.getStatus());

    if (url.pathname === "/prepare" && request.method === "POST") {
      const command = await request.json<AgentCommand>();
      const prepared: PreparedCommand = {
        token: crypto.randomUUID(),
        command,
        summary: commandSummary(command),
        expiresAt: Date.now() + 60_000
      };
      await this.state.storage.put(`confirmation:${prepared.token}`, prepared);
      return Response.json(prepared);
    }

    if (url.pathname === "/execute" && request.method === "POST") {
      const body = await request.json<{ token: string }>();
      const key = `confirmation:${body.token}`;
      const prepared = await this.state.storage.get<PreparedCommand>(key);
      await this.state.storage.delete(key);
      if (!prepared || prepared.expiresAt < Date.now()) {
        return Response.json({ error: "Confirmation token is invalid, expired, or already used" }, { status: 409 });
      }
      try {
        const result = await this.enqueue(prepared.command);
        return Response.json({ command: prepared.command, result });
      } catch (error) {
        return Response.json({ command: prepared.command, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
      }
    }

    if (url.pathname === "/command" && request.method === "POST") {
      const command = await request.json<AgentCommand>();
      const result = WRITE_ACTIONS.has(command.action)
        ? await this.enqueue(command)
        : await this.sendCommand(command);
      return Response.json({ command, result });
    }

    return new Response("Not found", { status: 404 });
  }

  private acceptAgent(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    for (const socket of this.state.getWebSockets("agent")) {
      socket.close(4001, "Replaced by a newer agent connection");
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, ["agent"]);
    void this.state.storage.put("connectedAt", Date.now());
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let parsed: AgentMessage;
    try {
      parsed = JSON.parse(message) as AgentMessage;
    } catch {
      return;
    }

    await this.state.storage.put("lastSeen", Date.now());
    if (parsed.type === "hello") {
      await this.storeHello(parsed);
      return;
    }
    if (parsed.type === "response") {
      await this.applyResponseSnapshot(parsed);
      const pending = this.pending.get(parsed.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(parsed.id);
      if (parsed.ok) pending.resolve(parsed.result);
      else pending.reject(new Error(parsed.error ?? "Agent command failed"));
    }
  }

  async webSocketClose(_socket: WebSocket, code: number, reason: string): Promise<void> {
    await this.state.storage.put("lastDisconnect", { timestamp: Date.now(), code, reason });
    this.rejectPending(new Error(`Agent disconnected: ${reason || code}`));
  }

  async webSocketError(_socket: WebSocket, error: unknown): Promise<void> {
    this.rejectPending(new Error(`Agent WebSocket error: ${String(error)}`));
  }

  private async storeHello(hello: AgentHello): Promise<void> {
    await this.state.storage.put("agent", {
      version: hello.version,
      computerId: hello.computerId,
      label: hello.label,
      capabilities: hello.capabilities,
      devices: hello.devices
    });
  }

  private async applyResponseSnapshot(response: AgentResponse): Promise<void> {
    if (!response.ok || typeof response.result !== "object" || response.result === null) return;
    const result = response.result as Record<string, unknown>;
    if (result.status) await this.state.storage.put("meStatus", result.status);
    if (result.devices) {
      const agent = await this.state.storage.get<Record<string, unknown>>("agent");
      await this.state.storage.put("agent", { ...agent, devices: result.devices });
    }
  }

  private async getStatus(): Promise<NetworkStatus> {
    const agent = await this.state.storage.get<Partial<NetworkStatus>>("agent");
    const meStatus = await this.state.storage.get<Record<string, unknown>>("meStatus");
    const connectedAt = await this.state.storage.get<number>("connectedAt");
    const lastSeen = await this.state.storage.get<number>("lastSeen");
    return {
      ...(agent ?? {}),
      ...(meStatus ?? {}),
      connected: this.state.getWebSockets("agent").length > 0,
      connectedAt,
      lastSeen,
      devices: agent?.devices ?? []
    } as NetworkStatus;
  }

  private enqueue(command: AgentCommand): Promise<unknown> {
    const task = this.mutationQueue.then(() => this.sendCommand(command));
    this.mutationQueue = task.catch(() => undefined);
    return task;
  }

  private async sendCommand(command: AgentCommand): Promise<unknown> {
    const socket = this.state.getWebSockets("agent")[0];
    if (!socket) throw new Error("ME agent is offline");
    const id = crypto.randomUUID();
    const request: AgentRequest = { type: "request", id, command };
    const response = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Agent command timed out after 30 seconds"));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
    });
    socket.send(JSON.stringify(request));
    return response;
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

