const { validate, sanitize } = use('Validator')
const merge = require('./mergeMixins')

module.exports = (path, mixins) => {
  let page = require(path)

  // Merge mixins
  if (page.mixins) {
    if (!Array.isArray(page.mixins)) page.mixins = [page.mixins]
    page.mixins.forEach(m => {
      page = merge(page, mixins(m))
    })
  }

  const queryKeys = Object.keys(page.query || {});
  ['query', 'params'].forEach(field => {
    if (page[field]) {
      Object.keys(page[field]).forEach((key) => !page[field][key] && delete page[field][key])
    }
  })

  return {
    middlewares: page.middlewares || [],
    clojure: async (...originals) => {
      const { request, params, auth, response } = originals[0]

      // Set headers
      if (page.headers) {
        Object.keys(page.headers).forEach(key => {
          response.header(key, page.headers[key])
        })
      }

      const query = request.only(queryKeys)
      const input = { params, query }

      // Validate and sanitize params and query
      await Promise.all(['query', 'params'].map(async field => {
        if (page[field]) {
          const validation = await validate(input[field], page[field])
          if (validation.fails()) {
            if (!page[field + 'Error']) throw new Error('BAD_' + field.toUpperCase())
            if (typeof page[field + 'Error'] === 'object') throw page[field + 'Error']
            if (typeof page[field + 'Error'] === 'function') return page[field + 'Error']({ query, params, auth, originals, validation })
          }
          input[field] = sanitize(input[field], page[field])
        }
      }))

      // Validate and fetch files
      const files = []
      if (page.files) {
        Object.keys(page.files).forEach(key => {
          files.push(request.file(key, page.files[key]))
        })
      }

      return page.handle({
        query,
        params,
        auth,
        files,
        request,
        response,
        originals
      })
    }
  }
}
