const fs = require('fs')
const path = require('path')
const ccxt = require('ccxt')
const yaml = require('js-yaml')
const Promise = require('bluebird')
const sortObj = require('sort-object')

const schemaPath = 'node_modules/coinspec-schema/src/exchange.yaml'
const exchangeSchema = yaml.safeLoad(fs.readFileSync(schemaPath))

function walkExchange(pick) {
  let exchange = new ccxt[pick]()
  let symbols = []
  let base = null

  let exchangesDir = path.join('../data/exchanges')
  let target = path.join(exchangesDir, pick, 'exchange.yaml')
  if (!fs.existsSync(target)) {
    let pickDir = path.join(exchangesDir, pick)
    if (!fs.existsSync(pickDir)) {
      fs.mkdirSync(pickDir)
    }
    base = {
      name: exchange.name
    }
    console.log('Exchange created: %s', pick)
  } else {
    base = yaml.safeLoad(fs.readFileSync(target))
  }
  let content = base

  if (!content.web && exchange.urls.www) {
    content.web = exchange.urls.www
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
  return walkExchange(e)
})

