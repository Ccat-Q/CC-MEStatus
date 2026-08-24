export type ResourceKind = "item" | "fluid" | "gas";
export type Direction = "north" | "south" | "east" | "west" | "up" | "down" | "front" | "back" | "left" | "right" | "top" | "bottom";
export type CommandAction = "refresh" | "craft" | "import" | "export";

export interface ResourceFilter {
  name: string;
  amount?: number;
  nbt?: string;
  fingerprint?: string;
}

export interface AgentCommand {
  action: CommandAction;
  resource: ResourceKind;
  filter?: ResourceFilter;
  target?: string;
  direction?: Direction;
  craftingCpu?: string;
}

export interface PeripheralDevice {
  name: string;
  types: string[];
  methods: string[];
}

export interface AgentCapabilities {
  bridgeName: string | null;
  methods: string[];
  resources: Record<ResourceKind, {
    list: boolean;
    craft: boolean;
    import: boolean;
    export: boolean;
  }>;
}

export interface AgentHello {
  type: "hello";
  protocol: 1;
  version: string;
  computerId: number;
  label: string | null;
  capabilities: AgentCapabilities;
  devices: PeripheralDevice[];
  timestamp: number;
}

export interface AgentRequest {
  type: "request";
  id: string;
  command: AgentCommand;
}

export interface AgentResponse {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  timestamp: number;
}

export type AgentMessage = AgentHello | AgentResponse;

export interface NetworkStatus {
  connected: boolean;
  connectedAt?: number;
  lastSeen?: number;
  version?: string;
  computerId?: number;
  label?: string | null;
  capabilities?: AgentCapabilities;
  devices: PeripheralDevice[];
  energy?: {
    stored: number | null;
    capacity: number | null;
    usage: number | null;
  };
  craftingCpus?: unknown[];
}

export interface PreparedCommand {
  token: string;
  command: AgentCommand;
  summary: string;
  expiresAt: number;
}

export interface DevicePolicy {
  name: string;
  favorite: boolean;
  favoriteOrder: number;
  writable: boolean;
  direction: Direction | null;
  itemLimit: number | null;
  fluidLimit: number | null;
  gasLimit: number | null;
  updatedAt: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: CommandAction;
  resource: ResourceKind;
  subject: string | null;
  amount: number | null;
  target: string | null;
  success: boolean;
  error: string | null;
  actor: string;
}

export const DEFAULT_LIMITS: Record<ResourceKind, number> = {
  item: 64,
  fluid: 1000,
  gas: 1000
};

export const WRITE_ACTIONS = new Set<CommandAction>(["craft", "import", "export"]);
