local updater = {}
local sha256 = require("sha256")

local function download(url)
  local response, reason = http.get(url, nil, true)
  if not response then error(reason or "Download failed", 0) end
  local body = response.readAll(); response.close(); return body
end

local function baseUrl(manifestUrl)
  return assert(manifestUrl:match("^(.*)/[^/]+$"), "Invalid manifest URL")
end

function updater.check(manifestUrl, destination)
  local manifest = textutils.unserializeJSON(download(manifestUrl))
  if type(manifest) ~= "table" or type(manifest.version) ~= "string" or type(manifest.files) ~= "table" then error("Invalid update manifest", 0) end
  if settings.get("mestatus.version") == manifest.version then return false end
  local downloaded = {}
  for name, metadata in pairs(manifest.files) do
    local body = download(baseUrl(manifestUrl) .. "/" .. name)
    if #body ~= metadata.size or sha256.digest(body) ~= metadata.sha256 then error("Hash verification failed for " .. name, 0) end
    downloaded[name] = body
  end
  for name, body in pairs(downloaded) do
    local path = fs.combine(destination, name); local tmp = path .. ".new"; local backup = path .. ".bak"
    local handle = assert(fs.open(tmp, "wb")); handle.write(body); handle.close()
    if fs.exists(backup) then fs.delete(backup) end
    if fs.exists(path) then fs.move(path, backup) end
    local ok, reason = pcall(fs.move, tmp, path)
    if not ok then if fs.exists(backup) then fs.move(backup, path) end error(reason, 0) end
  end
  settings.set("mestatus.version", manifest.version); settings.save()
  return true
end
return updater

