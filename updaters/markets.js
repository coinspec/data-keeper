const fs = require('fs')
const path = require('path')
const ccxt = require('ccxt')
const yaml = require('js-yaml')
const Promise = require('bluebird')
const sortObj = require('sort-object')

const schemaPath = '../node_modules/coinspec-schema/src/exchange.yaml'
const exchangeSchema = yaml.safeLoad(fs.readFileSync(schemaPath))

const ignore = [ 'bitfinex2', 'coinmarketcap', 'hitbtc2' ]

function walkExchange(pick) {
  let exchange = new ccxt[pick]()
  let symbols = []
  let base = null

  let exchangesDir = path.join('../../data/exchanges')
  let target = path.join(exchangesDir, pick, 'exchange.yaml')
  let pickDir = path.join(exchangesDir, pick)
  if (!fs.existsSync(target)) {
    base = {
      name: exchange.name
    }
  } else {
    base = yaml.safeLoad(fs.readFileSync(target))
  }
  let content = base

  if (!content.web && exchange.urls.www) {
    content.web = exchange.urls.www
  }
  if (!content.countries && exchange.countries) {
    content.countries = exchange.countries
  }
  if (!content.api) {
    content.api = {}
  }
  if (!content.api.url && exchange.urls.api) {
    content.api.url = exchange.urls.api
  }

  return exchange.loadMarkets()
  .catch((e) => {
    console.log(e)
  })
  .then((markets) => {
    if (!markets) {
      return null
    }
    for (let m in markets) {
      let id = markets[m].symbol
      symbols.push(id)
    }
    content.markets = symbols.sort()

    if (!fs.existsSync(pickDir)) {
      fs.mkdirSync(pickDir)
      console.log('Exchange created: %s', pick)
    }

    fs.writeFileSync(target, yaml.safeDump(renderJSON(content)))
    console.log('Exchange updated: %s', pick)
  })
}

function renderJSON(content) {
  // sort by schema
  content = sortObj(content, { keys: Object.keys(exchangeSchema.properties) })
  for (let k in content) {
    if (content[k] === undefined) {
      delete content[k]
    }
  }
  return content
}

Promise.map(ccxt.exchanges, (e) => {
  if (ignore.indexOf(e) !== -1) {
    return null
  }
  return walkExchange(e)
})

