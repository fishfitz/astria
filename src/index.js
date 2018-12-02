const assemble = require('./assemble')
const path = require('path')
const klaw = require('klaw')
const Helpers = require('Helpers')

const collect = (folder) => {
  const items = []

  return new Promise((resolve, reject) => {
    klaw(path.relative(Helpers.appRoot(), folder))
      .on('data', item => !item.stats.isDirectory() && items.push(item.path))
      .on('end', () => {
        resolve(items)
      })
  })
}

module.exports = async (Route, pageFolder = 'Pages', mixinsFolder = 'Mixins') => {
  const mixins = await collect(mixinsFolder)
  const mixinsMap = {}
  mixins.forEach(m => {
    mixinsMap[path.dirname(path.relative(Helpers.appRoot(), m)).replace(/\\/g, '/')] = require(m)
  })

  const pages = await collect(pageFolder)
  pages.forEach(p => {
    let [methods, ...filename] = path.basename(p).split('$')
    if (!filename.length) {
      filename = [methods]
      methods = 'HEAD,GET'
    }

    const route = '/' + path.join(
      path.dirname(path.relative(Helpers.appRoot(), p)),
      filename.join().replace(/\.[^/.]+$/, '').replace(/_(.+)/g, ':$1?')
    ).replace(/\\/g, '/').replace(/_([^/]+)/g, ':$1')

    const { clojure, middlewares } = assemble(p, mixinsMap)
    Route
      .route(route, clojure, methods.toUpperCase().split(','))
      .middlewares(middlewares)
  })
}

module.exports()
