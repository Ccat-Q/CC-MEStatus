local me = {}

local RESOURCE_METHODS = {
  item = {
    list = { "getItems", "listItems" }, craft = { "craftItem" },
    importPeripheral = { "importItemFromPeripheral" }, importDirection = { "importItem" },
    exportPeripheral = { "exportItemToPeripheral" }, exportDirection = { "exportItem" }
  },
  fluid = {
    list = { "getFluids", "listFluid", "listFluids" }, craft = { "craftFluid" },
    importPeripheral = { "importFluidFromPeripheral" }, importDirection = { "importFluid" },
    exportPeripheral = { "exportFluidToPeripheral" }, exportDirection = { "exportFluid" }
  },
  gas = {
    list = { "getChemicals", "listGas", "listGases", "listChemical" }, craft = { "craftChemical", "craftGas" },
    importPeripheral = { "importGasFromPeripheral", "importChemicalFromPeripheral" }, importDirection = { "importGas", "importChemical" },
    exportPeripheral = { "exportGasToPeripheral", "exportChemicalToPeripheral" }, exportDirection = { "exportGas", "exportChemical" }
  }
}
local FILTERED_LIST_METHODS = { getItems = true, getFluids = true, getChemicals = true }

local function hasType(name, wanted)
  local types = { peripheral.getType(name) }
  for _, value in ipairs(types) do if value == wanted then return true end end
  return false
end

local function methodSet(name)
  local result = {}
  for _, method in ipairs(peripheral.getMethods(name) or {}) do result[method] = true end
  return result
end

local function firstSupported(methods, choices)
  for _, name in ipairs(choices) do if methods[name] then return name end end
  return nil
end

function me.discover()
  local bridgeName, bridgeMethods
  local devices = {}
  for _, name in ipairs(peripheral.getNames()) do
    local types = { peripheral.getType(name) }
    local methods = peripheral.getMethods(name) or {}
    table.insert(devices, { name = name, types = types, methods = methods })
    if not bridgeName and (hasType(name, "me_bridge") or hasType(name, "meBridge")) then
      bridgeName, bridgeMethods = name, methodSet(name)
    end
  end

  bridgeMethods = bridgeMethods or {}
  local resources = {}
  for kind, candidates in pairs(RESOURCE_METHODS) do
    resources[kind] = {
      list = firstSupported(bridgeMethods, candidates.list) ~= nil,
      craft = firstSupported(bridgeMethods, candidates.craft) ~= nil,
      import = firstSupported(bridgeMethods, candidates.importPeripheral) ~= nil or firstSupported(bridgeMethods, candidates.importDirection) ~= nil,
      export = firstSupported(bridgeMethods, candidates.exportPeripheral) ~= nil or firstSupported(bridgeMethods, candidates.exportDirection) ~= nil
    }
  end
  local methods = {}
  for name in pairs(bridgeMethods) do table.insert(methods, name) end
  table.sort(methods)
  return {
    bridgeName = bridgeName,
    methods = methods,
    resources = resources
  }, devices
end

local function call(bridge, method, ...)
  if not method or type(bridge[method]) ~= "function" then error("Capability is not available in this mod combination", 0) end
  local result = table.pack(bridge[method](...))
  if result.n >= 2 and result[1] == false then error(tostring(result[2]), 0) end
  if result[1] == nil and result.n >= 2 and result[2] then error(tostring(result[2]), 0) end
  return table.unpack(result, 1, result.n)
end

local function optionalCall(bridge, method)
  if not method or type(bridge[method]) ~= "function" then return nil end
  local ok, value = pcall(bridge[method])
  if ok then return value end
  return nil
end

local function currentStatus(bridge, methods)
  local storedMethod = firstSupported(methods, { "getStoredEnergy", "getEnergyStorage" })
  local capacityMethod = firstSupported(methods, { "getEnergyCapacity", "getMaxEnergyStorage" })
  return {
    energy = {
      stored = optionalCall(bridge, storedMethod),
      capacity = optionalCall(bridge, capacityMethod),
      usage = optionalCall(bridge, methods.getEnergyUsage and "getEnergyUsage" or nil)
    },
    craftingCpus = optionalCall(bridge, methods.getCraftingCPUs and "getCraftingCPUs" or nil)
  }
end

function me.status(capabilities)
  capabilities = capabilities or select(1, me.discover())
  if not capabilities.bridgeName then return nil end
  return currentStatus(peripheral.wrap(capabilities.bridgeName), methodSet(capabilities.bridgeName))
end

local function listResources(bridge, method)
  if not method then error("No compatible resource list method is exposed by this ME Bridge", 0) end
  local resources
  if FILTERED_LIST_METHODS[method] then
    resources = call(bridge, method, {})
  else
    resources = call(bridge, method)
  end
  if type(resources) ~= "table" then error("ME Bridge returned an invalid resource list", 0) end
  for _, resource in pairs(resources) do
    if type(resource) == "table" and resource.amount == nil and type(resource.count) == "number" then
      resource.amount = resource.count
    end
  end
  return resources
end

local function normalizeFilter(filter)
  local result = { name = assert(filter.name, "Resource name is required"), count = filter.amount or 1 }
  if filter.nbt then result.nbt = filter.nbt end
  if filter.fingerprint then result.fingerprint = filter.fingerprint end
  return result
end

function me.execute(command)
  local capabilities, devices = me.discover()
  if not capabilities.bridgeName then error("No me_bridge peripheral is attached", 0) end
  local bridge = peripheral.wrap(capabilities.bridgeName)
  local methods = methodSet(capabilities.bridgeName)
  local candidates = assert(RESOURCE_METHODS[command.resource], "Unsupported resource kind")

  if command.action == "refresh" then
    local listMethod = firstSupported(methods, candidates.list)
    return { resources = listResources(bridge, listMethod), status = currentStatus(bridge, methods), devices = devices }
  end

  local filter = normalizeFilter(assert(command.filter, "Resource filter is required"))
  if command.action == "craft" then
    local craftMethod = firstSupported(methods, candidates.craft)
    if command.craftingCpu then return call(bridge, craftMethod, filter, command.craftingCpu) end
    return call(bridge, craftMethod, filter)
  end

  local peripheralMethod, directionMethod
  if command.action == "import" then
    peripheralMethod = firstSupported(methods, candidates.importPeripheral)
    directionMethod = firstSupported(methods, candidates.importDirection)
  elseif command.action == "export" then
    peripheralMethod = firstSupported(methods, candidates.exportPeripheral)
    directionMethod = firstSupported(methods, candidates.exportDirection)
  else
    error("Unsupported command action", 0)
  end
  local target = command.direction or command.target
  if command.target and peripheralMethod then
    return call(bridge, peripheralMethod, filter, command.target)
  end
  if target and directionMethod then return call(bridge, directionMethod, filter, target) end
  error("No compatible transfer method is available for the authorized target", 0)
end

return me
