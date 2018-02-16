const ccxt = require('ccxt')

console.log(ccxt.exchanges)
let bfx = new ccxt.binance()
let symbols = []

bfx.loadMarkets().then((markets) => {
  for (let m in markets) {
    let id = markets[m].symbol
    symbols.push(id)
  }
  console.log(symbols)
  console.log(symbols.length)
})
