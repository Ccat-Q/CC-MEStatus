import { describe, expect, it } from "vitest";
import { resourceIconUrl } from "./resourceIcons";

describe("resource icons", () => {
  it("uses an extracted texture only for item resources", () => {
    const icons = { "ae2:annihilation_core": "/icons/ae2/annihilation_core.png" };
    expect(resourceIconUrl({ name: "ae2:annihilation_core" }, "item", icons)).toBe("/icons/ae2/annihilation_core.png");
    expect(resourceIconUrl({ name: "mekanism:hydrogen" }, "gas", icons)).toBeUndefined();
  });
});
