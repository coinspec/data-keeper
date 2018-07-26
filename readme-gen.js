const ejs = require('ejs')
const fs = require('fs')
const path = require('path')

const dataDir = process.cwd()

const Data = require('./data.lib.js').Data
const data = new Data(dataDir)

const counts = data.counts()

let src = fs.readFileSync(path.join(dataDir, 'README.src.md')).toString()
let options = {}
let args = {
  collections: {
    projects: {
      name: 'Projects',
      count: counts.projects,
      schema: 'project'
    },
    exchanges: {
      name: 'Exchanges',
      count: counts.exchanges,
      schema: 'exchange'
    },
    wallets: {
      name: 'Wallets',
      count: counts.wallets,
      schema: 'wallet'
    },
    trackers: {
      name: 'Trackers',
      count: counts.trackers,
      schema: 'tracker'
    }
  }
}
let output = ejs.render(src, args, options)
let outputFn = path.join(dataDir, 'README.md')

fs.writeFileSync(outputFn, output)
console.log('README.md generated: %s', outputFn)
console.log('-------------')
console.log(output)
