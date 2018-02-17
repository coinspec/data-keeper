const request = require('request')
const cheerio = require('cheerio')
const Promise = require('bluebird')

const Data = require('../data.lib.js').Data
const data = new Data('../../data')

const tickerUrl = 'https://api.coinmarketcap.com/v1/ticker/'
const listUrl = 'https://coinmarketcap.com/all/views/all/'
const coinUrl = 'https://coinmarketcap.com/currencies/'

function updateCoins (coins) {
  //coins = coins.slice(0,10)
  return Promise.each(coins, (coin) => {
    let url = coinUrl + coin.id
    if (data.find('assets', coin.symbol.toLowerCase())) {
      console.log('Coin %s found, skipping ..', coin.id)
      return Promise.resolve()
    }

    console.log('Updating coin: %s [%s]', coin.name, url)
    return new Promise((done) => {
      request(url, (err, resp, body) => {
        $ = cheerio.load(body)
        let webids = {}
        let links = {
          web: [],
          explorer: [],
          messageBoard: [],
          chats: [],
        }
        $('div.bottom-margin-2x div.col-sm-4 ul li').each((i, el) => {
          let link = $(el).find('a')
          let cat = link.text()
          let target = link.attr('href')
          if (!cat.trim()) {
            
          } else if (cat.match(/^Website( \d|)$/)) {
            links.web.push(target)
          } else if (cat.match(/^Explorer( \d|)$/)) {
            links.explorer.push(target)
          } else if (cat.match(/^Message Board( \d|)$/)) {
            links.messageBoard.push(target)
          } else if (cat.match(/^Chat( \d|)$/)) {
            if (target.match(/\/t\.me\//)) {
              webids.telegram = target
            } else {
              links.chats.push(target)
            }
          } else if (cat.match(/^Source Code$/)) {
            if (target.match(/github\.com/)) {
              webids.github = target.match(/github\.com\/([^\/]+)(\/|)/)[1]
              webids.coinmarketcap = coin.id
            }
          }
        })
        let propsText = $('div.bottom-margin-2x div.col-sm-4 ul li:last-child').text()
        console.log(propsText)
        let props = {}
        if (propsText.match(/Coin/)) {
          props.type = 'coin'
        }
        else if (propsText.match(/Token/)) {
          props.type = 'token'
        }
        else if (propsText.match(/Rank/)) {}
        else {
          throw new Error('Unexpected prop text = ' + propsText)
        }
        if (propsText.match(/\nMineable\n/)) {
          props.mineable = true
        }
        let item = {
          name: $('h1.text-large img').attr('alt'),
          symbol: coin.symbol,
          type: props.type || 'coin',
          web: links.web,
          resources: {
            'message-board': links.messageBoard
          },
          webids: webids,
          tools: {
            explorer: links.explorer
          },
          mineable: props.mineable || false,
        }
        console.log(JSON.stringify(item, null, 2))
        return data.update('assets', coin.symbol.toLowerCase(), item).then(() => {
          done()
        })
      })
    })
  })
}

function getList () {
  console.log('Downloading list: %s', listUrl)
  return new Promise((done) => {
    request(listUrl, (err, resp, body) => {
      let $ = cheerio.load(body)
      let coins = []
      $('table#currencies-all tbody tr').each((i, el) => {
        coins.push({
          id: $(el).attr('id').replace(/^id-/, ''),
          name: $(el).find('td.currency-name a.currency-name-container').text(),
          symbol: $(el).find('td.col-symbol').text(),
        })
      })
      return done(coins)
    })
  })
}

let coins = []
getList().then((coins) => {
  console.log(coins)
  console.log('Coins indexed: %s', coins.length)
  updateCoins(coins).then(() => {
    console.log('done')
  })
})

