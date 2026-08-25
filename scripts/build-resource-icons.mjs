import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { unzipSync } from "fflate";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const instanceArg = valueAfter("--instance");
if (!instanceArg) throw new Error("Usage: npm run icons:generate -- --instance <Minecraft instance directory>");

const instanceDir = resolve(instanceArg);
const dictionaryPath = resolve(valueAfter("--dictionary") ?? "apps/web/public/locales/zh_cn.json");
const outputDir = resolve(valueAfter("--output") ?? "apps/web/public/icons");
if (!existsSync(instanceDir) || !existsSync(dictionaryPath)) throw new Error("Minecraft instance or zh-CN dictionary does not exist");

const dictionary = JSON.parse(readFileSync(dictionaryPath, "utf8"));
const targetPaths = new Map();
for (const registryName of Object.keys(dictionary.item ?? {})) {
  const separator = registryName.indexOf(":");
  if (separator < 1) continue;
  const namespace = registryName.slice(0, separator);
  const path = registryName.slice(separator + 1);
  targetPaths.set(`assets/${namespace}/textures/item/${path}.png`, registryName);
  targetPaths.set(`assets/${namespace}/textures/block/${path}.png`, registryName);
}

const iconIndex = {};
const outputFor = (registryName) => {
  const [namespace, ...parts] = registryName.split(":");
  return join(outputDir, namespace, `${parts.join(":")}.png`);
};
const writeIcon = (registryName, contents) => {
  const target = outputFor(registryName);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  iconIndex[registryName] = `/${relative(resolve("apps/web/public"), target).replaceAll("\\", "/")}`;
};

function mergeArchive(path) {
  const files = unzipSync(new Uint8Array(readFileSync(path)), { filter: ({ name }) => targetPaths.has(name.replaceAll("\\", "/")) });
  for (const [sourcePath, contents] of Object.entries(files)) {
    const registryName = targetPaths.get(sourcePath.replaceAll("\\", "/"));
    if (registryName) writeIcon(registryName, contents);
  }
}

function mergeDirectory(path) {
  const assetsDir = join(path, "assets");
  if (!existsSync(assetsDir)) return;
  for (const [sourcePath, registryName] of targetPaths) {
    const source = join(path, sourcePath);
    if (existsSync(source)) writeIcon(registryName, readFileSync(source));
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
for (const archive of archives.sort((left, right) => left.localeCompare(right))) mergeArchive(archive);

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

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "index.json"), `${JSON.stringify(iconIndex)}\n`, "utf8");
console.log(`Built ${Object.keys(iconIndex).length} direct resource icons`);
