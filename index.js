#!/usr/local/bin/node

const fs = require('fs')
const path = require('path')
const Data = require('./data.lib.js').Data
const axios = require('axios')
const chalk =  require('chalk')

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
    async function doBuild () {
      await buildData()
      await buildContributors()
      await buildWebapp()
      console.log('Build done')
    }
    async function buildData () {
      let dump = data.dump()
      let fn = path.join(outputDir, 'data.json')
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir)
      }
      fs.writeFileSync(fn, JSON.stringify(dump, null, 2))
      console.log('Data written to file: %s', fn)
    }
    async function buildContributors () {
      const contributorsFn = path.join(outputDir, 'contributors.json')
      let headers = {}
      if (process.env['GITHUB_TOKEN']) {
        headers.Authorization = "token " + process.env['GITHUB_TOKEN']
      }
      let contributors = null
      try {
        contributors = await axios({
          url: 'https://api.github.com/repos/opencrypto-io/data/contributors',
          headers
        })
      } catch (e) {
        console.error('Cannot get contributors: ' + e)
        console.error(JSON.stringify(e.response.data))
        process.exit(1)
      }
      fs.writeFileSync(contributorsFn, JSON.stringify(contributors.data, null, 2))
      console.log('Contributors written: %s', contributorsFn)
    }
    async function buildWebapp () {
      let webappDir = path.join(__dirname, 'node_modules/opencrypto-data-web/dist')
      fs.readdirSync(webappDir).forEach(f => {
        let src = path.join(webappDir, f)
        let dest = path.join(outputDir, f)
        fs.copyFileSync(src, dest)
        console.log(`Copying webapp file: ${f} => ${dest}`)
      })
    }
    doBuild()
    break

  case 'print':
    console.log(data.dump())
    break

  case 'test':
    try {
      data.test({ describe, it })
    } catch(e) {
      console.error(chalk.white.bgRed('Error!', e))
    }
    break
}
