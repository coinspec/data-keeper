const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const yaml = require('js-yaml')
const _ = require('lodash')

var Schema = null

class Data {
  constructor (dir) {
    if (!dir) {
      dir = process.cwd()
    }

    this.dir = dir
    this.loaded = false
    this.schemaDir = path.join(this.dir, 'schema')

    Schema = require(this.schemaDir)
    if (!Schema) {
      throw new Error('Schema not loaded: ' + this.schemaDir)
    }

    this.collections = {
      projects: {
        schema: 'project'
      },
      assets: {
        schema: 'asset'
      },
      clients: {
        schema: 'client'
      },
      networks: {
        schema: 'network'
      },
      blocks: {
        schema: 'block'
      },
      transactions: {
        schema: 'transaction'
      },
      exchanges: {
        schema: 'exchange'
      },
      markets: {
        schema: 'market'
      },
      core: {
        schema: 'core'
      },
    }
    this.ajv = new Ajv()
    this.ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))

    this.data = {}
    this.loadSchemas()
  }
  load () {
    var self = this
    this.data = {}
    function readPkgDir (col, dir) {
      if (!fs.existsSync(dir)) {
        return
      }
      fs.readdirSync(dir).forEach((pkg) => {
        if (!self.data[col]) {
          self.data[col] = []
        }
        if (pkg.substring(0,1) === ".") {
          return
        }
        self.data[col].push(new Package(pkg, col, path.join(dir, pkg), self))
      })
    }
    Object.keys(this.collections).forEach((col) => {
      let cdir = path.join(this.dir, 'collections', col)
      if (this.collections[col].subdirs) {
        fs.readdirSync(cdir).forEach((scol) => {
          readPkgDir(col, path.join(cdir, scol))
        })
      } else {
        readPkgDir(col, cdir)
      }
    })
    this.loaded = true
  }
  loadSchemas () {
    Object.keys(Schema.models).forEach((schemaName) => {
      this.ajv.addSchema(Schema.models[schemaName], schemaName)
      let ckey = _.findKey(this.collections, { schema: schemaName })
      if (!ckey) {
        throw new Error('No defined collection: ' + schemaName)
      }
      this.collections[ckey].schemaObj = Schema.models[schemaName]
    })
  }
  test (fw) {
    if (!this.loaded) {
      this.load()
    }
    if (!fw) {
      fw = {
        describe: () => {},
        it: () => {}
      }
    }
    Object.keys(this.collections).forEach((col) => {
      fw.describe(col, () => {
        if (!this.data[col]) {
          return
        }
        this.data[col].forEach((pkg) => {
          pkg.test(fw)
        })
      })
    })
  }
  dump (cols = null) {
    if (!this.loaded) {
      this.load()
    }
    if (!cols) {
      cols = Object.keys(this.collections)
    }
    let output = {}
    cols.forEach((col) => {
      output[col] = []
      if (!this.data[col]) return null
      this.data[col].forEach((item) => {
        output[col].push(item.dump())
      })
    })
    return output //JSON.stringify(output, null, 2)
  }
  counts () {
    if (!this.loaded) {
      this.load()
    }
    let output = {}
    Object.keys(this.collections).forEach((col) => {
      output[col] = this.data[col].length
    })
    return output
  }
  find (collection, id) {
    if (!this.loaded) {
      this.load()
    }
    return _.find(this.data[collection], { id })
  }
  update (collection, id, item) {
    if (!this.loaded) {
      this.load()
    }
    let pkg = _.find(this.data[collection], { id: id })
    if (!pkg) {
      // this item doesnt exists, so we create
      // first directory
      let pkgDir = path.join(this.dir, collection, id)

      // if its subdir collection
      if (this.collections[collection].subdirs) {
        let parentDirId = id.substr(0,1)
        if (parentDirId.match(/^(\d+)$/)) {
          parentDirId = '0'
        } else if (parentDirId.match(/^[\w\d]+$/)) {
        } else {
          console.log('bad id !! = %s', parentDirId)
        }
        let parentDir = path.join(this.dir, collection, parentDirId)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir)
        }
        pkgDir = path.join(parentDir, id)
      }
      if (!fs.existsSync(pkgDir)) {
        fs.mkdirSync(pkgDir)
      }
      // then package
      let indexFn = path.join(pkgDir, collection.substr(0, collection.length-1))
      fs.writeFileSync(indexFn + '.yaml', yaml.safeDump(item))
    }
    return Promise.resolve()
  }
}

class Package {
  constructor (id, col, dir, data) {
    this.id = id
    this.col = col
    this.data = data
    this.indexFn = this.col.substr(0, this.col.length-1)
    this.dir = dir
    this.index = null
    this.files = []

    this.loadFiles()
    this.loadIndex()
  }
  loadIndex () {
    let file = path.join(this.dir, this.indexFn + '.yaml')
    if (!fs.existsSync(file)) {
      let msg = `File not exists: ${file}`
      throw new Error(msg)
      return false
    }
    try {
      this.index = yaml.safeLoad(fs.readFileSync(file))
    } catch (e) {
      throw new Error('File syntax error: ' + file + "\n" + e)
    }
    this.index.id = this.id
  }
  loadFiles () {
    fs.readdirSync(this.dir).forEach((f) => {
      if (f === this.indexFn + '.yaml') {
        return
      }
      let pp = path.parse(f)
      switch (pp.ext) {
        case '.svg':
        case '.png':
          this.files.push({
            file: f,
            cat: 'images',
            name: pp.name,
            base: pp.base,
            type: pp.ext.substr(1),
          })
          break
        case '.pdf':
          this.files.push({
            file: f,
            cat: 'whitepapers',
            name: pp.name,
            base: pp.base,
            type: pp.ext.substr(1)
          })
          break
      }
    })
  }
  test (fw) {
    fw.describe(this.id, () => {
      fw.it('Check index schema', () => {
        if (!this.data.ajv.validate(this.indexFn, this.dump())) {
          let msg = `Index schema validation error: ${this.col}/${this.id}`
            + `\n\n${JSON.stringify(this.data.ajv.errors, null, 2)}`
          throw new Error(msg)
          return false
        }
      })
      if (this.files.length > 0) {
        this.files.forEach((f) => {
          fw.it(`Check file "${f.base}"`, () => {
          })
        })
      }
    })
  }
  dump () {
    let output = Object.assign({}, this.index)

    // render files into object
    if (this.files.length > 0) {
      this.files.forEach((f) => {
        if (f.cat === 'whitepapers') {
          let githubPrefix = 'https://github.com/opencrypto-io/data/blob/master/'
          output.whitepaper = githubPrefix + [ this.col, this.id, f.base ].join('/')
          return
        }
        if (!output[f.cat]) {
          output[f.cat] = {}
        }
        let fn = path.join(this.dir, f.file)
        output[f.cat][f.name.replace('-', '_')] = {
          type: f.type,
          data: fs.readFileSync(fn).toString('base64')
        }
      })
    }
    return output
  }
}

module.exports = {
  Data,
  Package
}
