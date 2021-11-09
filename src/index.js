const assemble = require('./assemble')
const path = require('path')
const klaw = require('klaw')
const Helpers = use('Helpers')
const Route = use('Route')
const { validations, sanitizor } = use('Validator')

const collect = (folder) => {
  const items = []

  return new Promise((resolve, reject) => {
    klaw(path.relative(Helpers.appRoot(), folder))
      .on('data', item => !item.stats.isDirectory() && items.push(item.path))
      .on('end', () => {
        resolve(items)
      })
      .on('error', (e) => {
        resolve(items)
      })
  })
}

let astriaRoutes
module.exports = {
  async init ({ pagesFolder = 'app/Pages', mixinsFolder = 'app/Mixins', rulesFolder = 'app/Rules', action } = {}) {
    const validationsRules = await collect(path.join(rulesFolder, 'Validation'))
    validationsRules.forEach(v => {
      validations[path.basename(v).replace(path.extname(v), '')] = require(v)
    })
    const sanitizationRules = await collect(path.join(rulesFolder, 'Sanitization'))
    sanitizationRules.forEach(s => {
      sanitizor[path.basename(s).replace(path.extname(s), '')] = require(s)
    })

    const mixins = await collect(mixinsFolder)
    const mixinsMap = {}
    mixins.forEach(m => {
      mixinsMap[path.basename(m).replace(path.extname(m), '')] = require(m)
    })

    const pages = await collect(pagesFolder)
    const routes = []
    const wildcard = []
    pages.forEach(p => {
      let [methods, ...filename] = path.basename(p).split('$')
      if (!filename.length) {
        filename = [methods]
        methods = 'HEAD,GET'
      }

      methods = methods.toUpperCase().split(',')

      let route = '/' + path.join(
        path.dirname(path.relative(path.join(Helpers.appRoot(), pagesFolder), p)),
        filename.join().replace(/\.[^/.]+$/, '').replace(/_([^_/]+)/g, '/:$1?/')
      ).replace(/\\/g, '/').replace(/_([^/]+)/g, ':$1')

      const page = assemble(p, mixinsMap)
      if (route === '/#') wildcard.push({ route: '*', methods, ...page })
      else routes.push({ route, methods, ...page })
    })
    if (!action) {
      action = (page) => {
        Route
          .route(page.route, page.clojure, page.methods)
          .middleware(page.middlewares)
      }
    }
    routes.forEach(action)
    wildcard.forEach(action)

    astriaRoutes = [...routes, ...wildcard]
  },
  get routes () {
    return astriaRoutes
  }
}
