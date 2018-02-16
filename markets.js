const ccxt = require('ccxt')
const fs = require('fs')
const yaml = require('js-yaml')
const Promise = require('bluebird')

function fetchMarkets(pick) {
  let exchange = new ccxt[pick]()
  let symbols = []

  let target = '../data/exchanges/'+pick+'/exchange.yaml'
  if (!fs.existsSync(target)) {
    console.log('Unindexed exchange: %s', pick)
    return false
  }
  let content = yaml.safeLoad(fs.readFileSync(target))

  return exchange.loadMarkets().then((markets) => {
    for (let m in markets) {
      let id = markets[m].symbol
      symbols.push(id)
    }
    delete content.pairs
    content.markets = symbols.sort()
    fs.writeFileSync(target, yaml.safeDump(content))
    console.log('Exchange updated: %s', pick)
  })
}

Promise.reduce(ccxt.exchanges, (total, e) => {
  return fetchMarkets(e)
})

