#!/usr/local/bin/node

const fs = require('fs')
const path = require('path')
const Data = require('./data.lib.js').Data

const outputDir = 'dist'

let dir = process.cwd()
let cmd = 'test'
if (!process.argv[2].match(/^node_modules/)) {
  cmd = process.argv[2]
}

console.log('Working directory: %s', dir)
console.log('Command: %s', cmd)
let data = new Data(dir)

switch (cmd) {
  case 'build':
    let dump = data.dump()
    let fn = path.join(outputDir, 'data.json')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    fs.writeFileSync(fn, JSON.stringify(dump, null, 2))
    console.log('Data written to file: %s', fn)
    break

  case 'print':
    console.log(data.dump())
    break

  case 'test':
    data.test({ describe, it })
    break
}
