import type { ResourceKind } from "@cc-mestatus/protocol";

export type ResourceIconIndex = Record<string, string>;

export const EMPTY_ICON_INDEX: ResourceIconIndex = {};

export function resourceIconUrl(item: Record<string, unknown>, kind: ResourceKind, icons: ResourceIconIndex): string | undefined {
  if (kind !== "item" || typeof item.name !== "string") return undefined;
  return icons[item.name];
}

export async function loadResourceIcons(): Promise<ResourceIconIndex> {
  const response = await fetch("/icons/index.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`物品图标索引加载失败 (${response.status})`);
  return response.json() as Promise<ResourceIconIndex>;
}
