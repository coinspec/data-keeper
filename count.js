
const Data = require('./data.lib.js').Data
const data = new Data('../data')
data.load()

let total = 0
let counts = {}

data.data.exchanges.forEach((e) => {
  let c = e.index.markets.length
  total += c
  counts[e.id] = c
})

console.log(total)
console.log(counts)

