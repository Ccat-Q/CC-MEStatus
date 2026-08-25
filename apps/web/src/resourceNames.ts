import type { ResourceKind } from "@cc-mestatus/protocol";

export type TranslationDictionary = Record<ResourceKind, Record<string, string>>;

export const EMPTY_TRANSLATIONS: TranslationDictionary = { item: {}, fluid: {}, gas: {} };

function readableRegistryName(registryName: string): string {
  const path = registryName.includes(":") ? registryName.slice(registryName.indexOf(":") + 1) : registryName;
  return path.replace(/[_-]+/g, " ").trim() || registryName || "未知资源";
}

export function isCorruptedDisplayName(value: string): boolean {
  return /\?|�/.test(value);
}

export function resourceTitle(item: Record<string, unknown>, kind: ResourceKind, translations: TranslationDictionary): string {
  const registryName = typeof item.name === "string" ? item.name : "";
  const translated = translations[kind][registryName]?.trim();
  if (translated) return translated;
  const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
  if (displayName && !isCorruptedDisplayName(displayName)) return displayName;
  return readableRegistryName(registryName);
}

export async function loadResourceTranslations(): Promise<TranslationDictionary> {
  const response = await fetch("/locales/zh_cn.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`中文词典加载失败 (${response.status})`);
  return response.json() as Promise<TranslationDictionary>;
}
