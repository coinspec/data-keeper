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

    this.webIds = yaml.safeLoad(fs.readFileSync(path.join(this.dir, 'db', 'webids.yaml')))

    this.collections = {
      projects: {
        schema: 'project'
      },
      assets: {
        schema: 'asset',
        parent: 'project'
      },
      clients: {
        schema: 'client',
        parent: 'project'
      },
      networks: {
        schema: 'network',
        parent: 'asset'
      },
      blocks: {
        schema: 'block',
        parent: 'network'
      },
      transactions: {
        schema: 'transaction',
        parent: 'block'
      },
      exchanges: {
        schema: 'exchange',
        parent: 'project'
      },
      markets: {
        schema: 'market',
        parent: 'exchange'
      },
      core: {
        schema: 'core'
      }
    }
    this.collectionsModels = {}
    Object.keys(this.collections).forEach(c => {
      let ic = this.collections[c]
      ic.plural = c
      this.collectionsModels[ic.schema] = ic
    })
    this.ajv = new Ajv()
    this.ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'))
    this.ajv.addKeyword('opencrypto-validation', {
      type: "object",
      validate: (type, obj) => {
        if (type === 'webid') {
          Object.keys(obj).forEach(kid => {
            if (['custom'].indexOf(kid.split('/')[0]) !== -1) {
              return true
            }
            if (!this.webIds[kid]) {
              throw new Error('Non existent webid: ' + kid)
            }
          })
        }
        return true
      }
    })

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
        if (pkg.substring(0, 1) === '.') {
          return
        }
        self.data[col].push(new Package(pkg, col, path.join(dir, pkg), self))
      })
    }
    let cdir = path.join(this.dir, 'db/projects')
    let col = 'projects'
    if (this.collections[col].subdirs) {
      fs.readdirSync(cdir).forEach((scol) => {
        readPkgDir(col, path.join(cdir, scol))
      })
    } else {
      readPkgDir(col, cdir)
    }
    this.loaded = true
  }
  strictSchema (obj, path) {
    if (obj.type == 'object' && obj.additionalProperties === undefined) {
      obj.additionalProperties = false
    }
    if (obj.type === undefined) {
    }
    Object.keys(obj).forEach(i => {
      if (typeof obj[i] === 'object' && obj[i].constructor === Object) {
        obj[i] = this.strictSchema(obj[i], path + '/' + i)
      }
      if (typeof obj[i] === 'array' && obj[i].constructor === Array) {
      }
    })
    return obj
  }
  loadSchemas () {
    Object.keys(Schema.models).forEach((schemaName) => {
      this.ajv.addSchema(Schema.models[schemaName], schemaName)
      let ckey = _.findKey(this.collections, { schema: schemaName })
      if (!ckey) {
        throw new Error('No defined collection: ' + schemaName)
      }
      this.collections[ckey].schemaObj = this.strictSchema(Schema.models[schemaName], schemaName)
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

    fw.describe('common', () => {
      fw.it('Check webids', () => {
      })
    })

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
    let col = 'projects'
    output[col] = []
    if (this.data[col]) {
      this.data[col].forEach((item) => {
        output[col].push(item.dump())
      })
    }
    output.metadata = {
      time: new Date()
    }
    return output // JSON.stringify(output, null, 2)
  }
  counts () {
    if (!this.loaded) {
      this.load()
    }
    let output = {}
    Object.keys(this.collections).forEach((col) => {
      if (!this.data[col]) {
        output[col] = 0
        return
      }
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
        let parentDirId = id.substr(0, 1)
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
      let indexFn = path.join(pkgDir, collection.substr(0, collection.length - 1))
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
    this.indexFn = this.col.substr(0, this.col.length - 1)
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
      let ind = { id: this.id }
      this.index = Object.assign(ind, yaml.safeLoad(fs.readFileSync(file)))
    } catch (e) {
      throw new Error('File syntax error: ' + file + '\n' + e)
    }
    this.index.id = this.id
  }
  loadFiles () {
    let subs = _.map(this.data.collections, i => i.schema)
    function isSubtype (pp) {
      let m = pp.name.match(new RegExp('^(' + subs.join('|') + ')-([a-z0-9]+)-'))
      if (!m) {
        return false
      }
      return [ m[1], m[2] ]
    }
    function fixSubs (subs, pp) {
      let bas = subs.join('-')
      let ck = ['name', 'base']
      ck.forEach(t => {
        pp[t] = pp[t].replace(new RegExp('^' + bas + '-'), '')
      })
      return pp
    }
    fs.readdirSync(this.dir).forEach((f) => {
      if (f === this.indexFn + '.yaml') {
        return
      }
      let pp = path.parse(f)
      let subtype = isSubtype(pp)
      if (subtype) {
        pp = fixSubs(subtype, pp)
      }

      let cat = null
      switch (pp.ext) {
        case '.svg':
        case '.png':
          cat = 'images'
          break
        case '.pdf':
          cat = 'whitepapers'
          break
        default:
          throw new Error('Unknown filetype: ' + pp.ext)
          break
      }
      let out = {
        file: f,
        subtype,
        cat,
        name: pp.name,
        base: pp.base,
        type: pp.ext.substr(1)
      }
      this.files.push(out)
    })
  }
  test (fw) {
    fw.describe(this.id, () => {
      fw.it('Check schema', () => {
        if (!this.data.ajv.validate(this.indexFn, this.dump())) {
          let msg = `Index schema validation error: ${this.col}/${this.id}` +
            `\n\n${JSON.stringify(this.data.ajv.errors, null, 2)}`
          throw new Error(msg)
          return false
        }
      })
      if (this.files.length > 0) {
        this.files.forEach((f) => {
          fw.it(`Check file "${f.file}"`, () => {
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
        let target = output
        if (f.subtype) {
          target = null
          let sn = this.data.collectionsModels[f.subtype[0]]
          if (sn.parent === 'project') {
            output[sn.plural].forEach(st => { target = st })
          } else {
            let snp = this.data.collectionsModels[sn.parent]
            output[snp.plural].forEach(st => {
              st[sn.plural].forEach(stt => { target = stt })
            })
          }
          if (!target) {
            throw new Error('Bad file target: ' + JSON.stringify(f, null, 2))
          }
        }

        if (f.cat === 'whitepapers') {
          let githubPrefix = 'https://github.com/opencrypto-io/data/blob/master/'
          target.whitepaper = githubPrefix + [ this.col, this.id, f.base ].join('/')
          return
        }
        if (!target[f.cat]) {
          target[f.cat] = {}
        }
        let fn = path.join(this.dir, f.file)
        target[f.cat][f.name.replace('-', '_')] = {
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
