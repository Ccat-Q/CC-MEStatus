local VERSION = "0.1.1"
local base = fs.getDir(shell.getRunningProgram())
if base ~= "" then package.path = base .. "/?.lua;" .. package.path end

local me = require("me")
local updater = require("updater")

settings.load()
local endpoint = settings.get("mestatus.endpoint")
local token = settings.get("mestatus.token")
local manifest = settings.get("mestatus.manifest")
if not endpoint or not token then error("ME Status is not configured. Run the installer again.", 0) end

if manifest then
  local ok, changed = pcall(updater.check, manifest, base)
  if ok and changed then os.reboot() end
end

local function hello()
  local capabilities, devices = me.discover()
  local status = me.status(capabilities)
  return {
    type = "hello", protocol = 1, version = VERSION,
    computerId = os.getComputerID(), label = os.getComputerLabel(),
    capabilities = capabilities, devices = devices,
    status = status,
    timestamp = os.epoch("utc")
  }
end

local function send(ws, value)
  ws.send(textutils.serializeJSON(value))
end

local function runConnection()
  local ws, reason = http.websocket({
    url = endpoint,
    headers = { Authorization = "Bearer " .. token },
    timeout = 20
  })
  if not ws then error(reason or "WebSocket connection failed", 0) end
  send(ws, hello())

  while true do
    local raw, receiveReason = ws.receive(20)
    if not raw then
      if receiveReason ~= "Timed out" then error(receiveReason or "Connection closed", 0) end
      send(ws, hello())
    else
      local request = textutils.unserializeJSON(raw)
      if type(request) == "table" and request.type == "request" and type(request.id) == "string" then
        local ok, result = pcall(me.execute, request.command)
        send(ws, {
          type = "response", id = request.id, ok = ok,
          result = ok and result or nil,
          error = ok and nil or tostring(result),
          timestamp = os.epoch("utc")
        })
      end
    end
  end
end

local delay = 1
while true do
  local ok, reason = pcall(runConnection)
  printError("ME Status disconnected: " .. tostring(reason))
  sleep(delay)
  delay = math.min(delay * 2, 60)
end
