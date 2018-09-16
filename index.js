#!/usr/local/bin/node

const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const Data = require('./data.lib.js').Data
const axios = require('axios')

const outputDir = 'dist'
const webRepoZip = 'https://github.com/opencrypto-io/data-web/archive/master.zip'

let dir = process.cwd()
let cmd = 'test'
if (!process.argv[2].match(/^node_modules/)) {
  cmd = process.argv[2]
}

let subcmd = null
if (process.argv[3]) {
  subcmd = process.argv[3]
}

console.log('Working directory: %s', dir)
console.log('Command: %s', cmd)
if (subcmd) {
  console.log('Sub-command: %s', subcmd)
}
let data = new Data(dir)

switch (cmd) {
  case 'build':
    async function doBuild () {
      await buildData()
      await buildContributors()
      if (subcmd === 'full') {
        await buildWebapp()
      }
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
      // download package
      console.log('Downloading web package ..')
      execSync(`mkdir -p tmp`)
      execSync(`curl -L -s -o tmp/web.zip ${webRepoZip}`)
      console.log('Unpacking ..')
      execSync(`unzip tmp/web.zip -d tmp/`)
      console.log('Web package prepared')

      // process
      let webappDir = path.join(process.cwd(), 'tmp/data-web-master/dist')
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
    data.test({ describe, it })
    break
}
