local methods = {
  listItems = true, craftItem = true, exportItemToPeripheral = true,
  getEnergyStorage = true, getMaxEnergyStorage = true, getEnergyUsage = true, getCraftingCPUs = true
}
local bridge = {
  listItems = function() return { { name = "minecraft:stone", amount = 12 } } end,
  craftItem = function(filter) return filter.count == 2, "invalid count" end,
  exportItemToPeripheral = function(filter, target) return filter.count + #target end,
  getEnergyStorage = function() return 50 end,
  getMaxEnergyStorage = function() return 100 end,
  getEnergyUsage = function() return 2 end,
  getCraftingCPUs = function() return {} end
}
peripheral = {
  getNames = function() return { "me_bridge_0", "minecraft:chest_0" } end,
  getType = function(name) if name == "me_bridge_0" then return "me_bridge" else return "inventory" end end,
  getMethods = function(name) local list = {} if name == "me_bridge_0" then for method in pairs(methods) do list[#list+1] = method end end return list end,
  wrap = function() return bridge end
}
local module = assert(loadfile("/mestatus/me.lua"))()
local capabilities = module.discover()
assert(capabilities.resources.item.list == true)
assert(capabilities.resources.fluid.import == false)
local refreshed = module.execute({ action = "refresh", resource = "item" })
assert(refreshed.resources[1].amount == 12)
assert(refreshed.status.energy.stored == 50)
local crafted = module.execute({ action = "craft", resource = "item", filter = { name = "minecraft:stone", amount = 2 } })
assert(crafted == true)
local exported = module.execute({ action = "export", resource = "item", filter = { name = "minecraft:stone", amount = 3 }, target = "minecraft:chest_0" })
assert(exported == 20)

methods = {
  getItems = true, craftItem = true, exportItem = true,
  getStoredEnergy = true, getEnergyCapacity = true, getEnergyUsage = true
}
bridge = {
  getItems = function(filter)
    assert(type(filter) == "table")
    local shared = { expensive = true }
    return {
      { name = "minecraft:granite", count = 21, displayName = "Granite", prototype = shared },
      { name = "minecraft:andesite", count = 7, displayName = "Andesite", components = shared }
    }
  end,
  craftItem = function(filter) return { requested = filter.count } end,
  exportItem = function(filter, target) return { count = filter.count, target = target } end,
  getStoredEnergy = function() return 75 end,
  getEnergyCapacity = function() return 150 end,
  getEnergyUsage = function() return 3 end
}
local modernCapabilities = module.discover()
assert(modernCapabilities.resources.item.list == true)
local modernRefresh = module.execute({ action = "refresh", resource = "item", offset = 1, limit = 1 })
assert(#modernRefresh.resources == 1)
assert(modernRefresh.resources[1].name == "minecraft:granite")
assert(modernRefresh.resources[1].amount == 21)
assert(modernRefresh.resources[1].prototype == nil)
assert(modernRefresh.total == 2 and modernRefresh.hasMore == false)
assert(modernRefresh.offset == 1 and modernRefresh.limit == 1)
assert(modernRefresh.status.energy.stored == 75)
assert(modernRefresh.status.energy.capacity == 150)
assert(modernRefresh.status.craftingCpus == nil)
local modernExport = module.execute({ action = "export", resource = "item", filter = { name = "minecraft:granite", amount = 4 }, target = "minecraft:chest_0" })
assert(modernExport.count == 4 and modernExport.target == "minecraft:chest_0")
print("me_spec: ok")

