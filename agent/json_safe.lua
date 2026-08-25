local jsonSafe = {}

local MAX_DEPTH = 48
local MAX_NODES = 200000

local function copyValue(value, state, depth)
  local valueType = type(value)
  if valueType == "nil" or valueType == "boolean" or valueType == "string" then return value end
  if valueType == "number" then
    if value ~= value then return "<nan>" end
    if value == math.huge then return "<infinity>" end
    if value == -math.huge then return "<-infinity>" end
    return value
  end
  if valueType ~= "table" then return tostring(value) end
  if state.ancestors[value] then return "<circular>" end
  if depth >= MAX_DEPTH then return "<max-depth>" end

  state.nodes = state.nodes + 1
  if state.nodes > MAX_NODES then return "<truncated>" end

  state.ancestors[value] = true
  local result = {}
  for key, child in pairs(value) do
    local keyType = type(key)
    local safeKey = (keyType == "string" or keyType == "number") and key or tostring(key)
    result[safeKey] = copyValue(child, state, depth + 1)
  end
  state.ancestors[value] = nil
  return result
end

function jsonSafe.copy(value)
  return copyValue(value, { ancestors = {}, nodes = 0 }, 0)
end

function jsonSafe.serialize(value)
  return textutils.serializeJSON(jsonSafe.copy(value))
end

return jsonSafe
