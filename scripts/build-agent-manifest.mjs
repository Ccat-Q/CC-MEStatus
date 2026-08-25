import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "agent");
const output = resolve(root, "apps/web/public/agent");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const files = ["agent.lua", "json_safe.lua", "me.lua", "sha256.lua", "updater.lua"];

await mkdir(output, { recursive: true });
const manifest = { version: packageJson.version, channel: "stable", files: {} };
for (const name of files) {
  const body = await readFile(resolve(source, name));
  manifest.files[name] = { size: body.length, sha256: createHash("sha256").update(body).digest("hex") };
  await cp(resolve(source, name), resolve(output, name));
}
await cp(resolve(source, "install.lua"), resolve(output, "install.lua"));
await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Built agent ${manifest.version} with ${files.length} verified files`);
