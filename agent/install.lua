local manifestUrl = ...
if not manifestUrl then error("Usage: wget run <install-url> <manifest-url>", 0) end
local function download(url)
  local response, reason = http.get(url, nil, true)
  if not response then error(reason or "Download failed", 0) end
  local body = response.readAll(); response.close(); return body
end
local baseUrl = assert(manifestUrl:match("^(.*)/[^/]+$"), "Invalid manifest URL")
local manifest = assert(textutils.unserializeJSON(download(manifestUrl)), "Invalid manifest")
local shaBody = download(baseUrl .. "/sha256.lua")
local shaMeta = assert(manifest.files["sha256.lua"], "Manifest does not contain sha256.lua")
if #shaBody ~= shaMeta.size then error("sha256.lua size verification failed", 0) end
local shaPath = "/mestatus/sha256.lua"
fs.makeDir("/mestatus")
local handle = assert(fs.open(shaPath, "wb")); handle.write(shaBody); handle.close()
local sha256 = assert(loadfile(shaPath))()
if sha256.digest(shaBody) ~= shaMeta.sha256 then fs.delete(shaPath); error("sha256.lua hash verification failed", 0) end
for name, metadata in pairs(manifest.files) do
  local body = name == "sha256.lua" and shaBody or download(baseUrl .. "/" .. name)
  if #body ~= metadata.size or sha256.digest(body) ~= metadata.sha256 then error("Hash verification failed for " .. name, 0) end
  local output = assert(fs.open(fs.combine("/mestatus", name), "wb")); output.write(body); output.close()
end
write("WebSocket endpoint (wss://.../agent/ws): "); local endpoint = read()
write("Agent token (hidden): "); local token = read("*")
settings.set("mestatus.endpoint", endpoint); settings.set("mestatus.token", token)
settings.set("mestatus.manifest", manifestUrl); settings.set("mestatus.version", manifest.version); settings.save()
fs.makeDir("/startup")
local startup = assert(fs.open("/startup/mestatus.lua", "w")); startup.writeLine('shell.run("/mestatus/agent.lua")'); startup.close()
print("ME Status installed. Reboot this computer to connect.")

