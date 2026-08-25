import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { strFromU8, unzipSync } from "fflate";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const instanceArg = valueAfter("--instance");
if (!instanceArg) {
  throw new Error("Usage: npm run translations:generate -- --instance <Minecraft instance directory>");
}

const instanceDir = resolve(instanceArg);
const outputPath = resolve(valueAfter("--output") ?? "apps/web/public/locales/zh_cn.json");
if (!existsSync(instanceDir)) throw new Error(`Minecraft instance does not exist: ${instanceDir}`);

const dictionaries = { item: new Map(), fluid: new Map(), gas: new Map() };
const ranks = { item: new Map(), fluid: new Map(), gas: new Map() };
const installedNamespaces = new Set();
let sourceOrder = 0;
let languageFileCount = 0;

const keyKinds = {
  item: ["item", 3],
  block: ["item", 2],
  fluid: ["fluid", 3],
  fluid_type: ["fluid", 3],
  chemical: ["gas", 3],
  gas: ["gas", 3]
};

function mergeLanguage(text, sourceName) {
  let values;
  try {
    values = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    console.warn(`Skipping invalid language file ${sourceName}: ${error.message}`);
    return;
  }
  languageFileCount++;
  for (const [translationKey, rawValue] of Object.entries(values)) {
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;
    const match = /^(item|block|fluid|fluid_type|chemical|gas)\.([^.]+)\.(.+)$/.exec(translationKey);
    if (!match || match[3].includes(".") || !installedNamespaces.has(match[2])) continue;
    const [kind, keyRank] = keyKinds[match[1]];
    const registryName = `${match[2]}:${match[3]}`;
    const rank = sourceOrder * 10 + keyRank;
    if ((ranks[kind].get(registryName) ?? -1) <= rank) {
      dictionaries[kind].set(registryName, rawValue.trim());
      ranks[kind].set(registryName, rank);
    }
  }
}

function mergeArchive(path, trackNamespaces = false) {
  sourceOrder++;
  const files = unzipSync(new Uint8Array(readFileSync(path)), {
    filter: ({ name }) => {
      const normalized = name.replaceAll("\\", "/");
      const namespace = /^assets\/([^/]+)\//i.exec(normalized)?.[1];
      if (trackNamespaces && namespace) installedNamespaces.add(namespace);
      return /^assets\/[^/]+\/lang\/zh_cn\.json$/i.test(normalized);
    }
  });
  for (const [name, contents] of Object.entries(files)) {
    mergeLanguage(strFromU8(contents), `${basename(path)}:${name}`);
  }
}

function walkLanguageFiles(root) {
  const result = [];
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkLanguageFiles(path));
    else if (/[/\\]assets[/\\][^/\\]+[/\\]lang[/\\]zh_cn\.json$/i.test(path)) result.push(path);
  }
  return result;
}

function mergeDirectory(path) {
  sourceOrder++;
  for (const file of walkLanguageFiles(path).sort((left, right) => left.localeCompare(right))) {
    mergeLanguage(readFileSync(file, "utf8"), file);
  }
}

const archives = [];
for (const entry of readdirSync(instanceDir, { withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name).toLowerCase() === ".jar") archives.push(join(instanceDir, entry.name));
}
const modsDir = join(instanceDir, "mods");
if (existsSync(modsDir)) {
  for (const entry of readdirSync(modsDir, { withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".jar") archives.push(join(modsDir, entry.name));
  }
}
for (const archive of archives.sort((left, right) => left.localeCompare(right))) mergeArchive(archive, true);

const resourcePacksDir = join(instanceDir, "resourcepacks");
if (existsSync(resourcePacksDir)) {
  const packs = readdirSync(resourcePacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || (entry.isFile() && extname(entry.name).toLowerCase() === ".zip"))
    .map((entry) => join(resourcePacksDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
  for (const pack of packs) {
    if (statSync(pack).isDirectory()) mergeDirectory(pack);
    else mergeArchive(pack);
  }
}

const sortedObject = (map) => Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
const output = {
  item: sortedObject(dictionaries.item),
  fluid: sortedObject(dictionaries.fluid),
  gas: sortedObject(dictionaries.gas)
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Built zh-CN dictionary from ${languageFileCount} language files: ${Object.keys(output.item).length} items, ${Object.keys(output.fluid).length} fluids, ${Object.keys(output.gas).length} gases`);
