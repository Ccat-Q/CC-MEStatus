import { describe, expect, it } from "vitest";
import { EMPTY_TRANSLATIONS, isCorruptedDisplayName, resourceTitle, type TranslationDictionary } from "./resourceNames";

const translations: TranslationDictionary = {
  item: { "advanced_ae:reaction_chamber": "反应仓", "ae2:16k_crafting_storage": "16k合成存储器" },
  fluid: {},
  gas: { "mekanism:hydrogen": "氢" }
};

describe("resource names", () => {
  it("detects display names damaged at the CC peripheral boundary", () => {
    expect(isCorruptedDisplayName("[????]")).toBe(true);
    expect(isCorruptedDisplayName("[16k????]")).toBe(true);
    expect(isCorruptedDisplayName("Reaction Chamber")).toBe(false);
  });

  it("uses the extracted Chinese translation before a damaged display name", () => {
    expect(resourceTitle({ name: "advanced_ae:reaction_chamber", displayName: "[????]" }, "item", translations)).toBe("反应仓");
    expect(resourceTitle({ name: "ae2:16k_crafting_storage", displayName: "[16k????]" }, "item", translations)).toBe("16k合成存储器");
    expect(resourceTitle({ name: "mekanism:hydrogen", displayName: "?" }, "gas", translations)).toBe("氢");
  });

  it("falls back to a readable registry path when no translation survives", () => {
    expect(resourceTitle({ name: "example:missing_name", displayName: "[????]" }, "item", EMPTY_TRANSLATIONS)).toBe("missing name");
  });
});
