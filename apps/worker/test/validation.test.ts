import { describe, expect, it } from "vitest";
import type { AgentCommand, DevicePolicy } from "@cc-mestatus/protocol";
import { authorizeCommand, CommandValidationError } from "../src/validation";

const limits = { item: 64, fluid: 1000, gas: 1000 };
const policy: DevicePolicy = {
  name: "minecraft:chest_0",
  favorite: true,
  favoriteOrder: 1,
  writable: true,
  direction: "north",
  itemLimit: null,
  fluidLimit: null,
  gasLimit: null,
  updatedAt: 0
};

function command(overrides: Partial<AgentCommand> = {}): AgentCommand {
  return {
    action: "export",
    resource: "item",
    filter: { name: "minecraft:stone", amount: 32 },
    target: policy.name,
    ...overrides
  };
}

describe("command authorization", () => {
  it("injects the authorized direction", () => {
    expect(authorizeCommand(command(), limits, policy).direction).toBe("north");
  });

  it("rejects an unauthorized target", () => {
    expect(() => authorizeCommand(command(), limits, { ...policy, writable: false }))
      .toThrow(CommandValidationError);
  });

  it("rejects amounts over the limit", () => {
    expect(() => authorizeCommand(command({ filter: { name: "minecraft:stone", amount: 65 } }), limits, policy))
      .toThrow("exceeds the configured limit");
  });

  it("uses a device-specific limit", () => {
    expect(authorizeCommand(command({ filter: { name: "minecraft:stone", amount: 128 } }), limits, { ...policy, itemLimit: 128 }))
      .toMatchObject({ filter: { amount: 128 } });
  });
});
