local module = assert(loadfile("/mestatus/json_safe.lua"))()

local shared = { name = "minecraft:stone", tags = { block = true } }
local copied = module.copy({ first = shared, second = shared })
assert(copied.first ~= copied.second)
assert(copied.first.name == "minecraft:stone")
assert(copied.second.tags.block == true)

local circular = { name = "loop" }
circular.self = circular
local circularCopy = module.copy(circular)
assert(circularCopy.self == "<circular>")

local special = module.copy({ nan = 0 / 0, positive = math.huge, negative = -math.huge })
assert(special.nan == "<nan>")
assert(special.positive == "<infinity>")
assert(special.negative == "<-infinity>")

local encoded = module.serialize({ first = shared, second = shared })
assert(type(encoded) == "string" and #encoded > 0)
print("json_safe_spec: ok")
