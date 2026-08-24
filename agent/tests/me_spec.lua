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
print("me_spec: ok")

