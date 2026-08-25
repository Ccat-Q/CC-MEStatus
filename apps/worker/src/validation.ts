import {
  DEFAULT_LIMITS,
  WRITE_ACTIONS,
  type AgentCommand,
  type DevicePolicy,
  type ResourceKind
} from "@cc-mestatus/protocol";

export class CommandValidationError extends Error {}

export function validateCommand(command: AgentCommand): void {
  if (!WRITE_ACTIONS.has(command.action) && command.action !== "refresh") {
    throw new CommandValidationError("Unsupported action");
  }
  if (!(["item", "fluid", "gas"] as string[]).includes(command.resource)) {
    throw new CommandValidationError("Unsupported resource kind");
  }
  if (command.action === "refresh") {
    const offset = command.offset ?? 0;
    const limit = command.limit ?? 200;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new CommandValidationError("Inventory page must use a non-negative offset and a limit from 1 to 200");
    }
  }
  if (WRITE_ACTIONS.has(command.action)) {
    if (!command.filter?.name) throw new CommandValidationError("A resource name is required");
    const amount = command.filter.amount ?? 1;
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new CommandValidationError("Amount must be a positive integer");
    }
  }
  if ((command.action === "import" || command.action === "export") && !command.target) {
    throw new CommandValidationError("An authorized target device is required");
  }
}

export function effectiveLimit(
  resource: ResourceKind,
  globalLimits: Record<ResourceKind, number>,
  policy?: DevicePolicy | null
): number {
  const override = policy?.[`${resource}Limit` as "itemLimit" | "fluidLimit" | "gasLimit"];
  return override ?? globalLimits[resource] ?? DEFAULT_LIMITS[resource];
}

export function authorizeCommand(
  command: AgentCommand,
  globalLimits: Record<ResourceKind, number>,
  policy?: DevicePolicy | null
): AgentCommand {
  validateCommand(command);
  if (!WRITE_ACTIONS.has(command.action)) return command;

  if (command.action === "import" || command.action === "export") {
    if (!policy?.writable || policy.name !== command.target) {
      throw new CommandValidationError("Target device is not authorized for writes");
    }
  }

  const amount = command.filter?.amount ?? 1;
  const limit = effectiveLimit(command.resource, globalLimits, policy);
  if (amount > limit) {
    throw new CommandValidationError(`Amount ${amount} exceeds the configured limit ${limit}`);
  }

  return policy?.direction && !command.direction
    ? { ...command, direction: policy.direction }
    : command;
}

export function commandSummary(command: AgentCommand): string {
  const amount = command.filter?.amount ?? 1;
  const resource = command.filter?.name ?? command.resource;
  const target = command.target ? ` via ${command.target}` : "";
  return `${command.action} ${amount} ${resource}${target}`;
}

