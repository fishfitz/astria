const { validate, sanitize, sanitizor } = use('Validator')
const merge = require('./mergeMixins')
const { mapValues, pickBy, camelCase } = use('lodash')

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

  const validationRules = {
    params: page.params ? pickBy(mapValues(page.params, 0), Boolean) : undefined,
    query: page.query ? pickBy(mapValues(page.query, 0), Boolean) : undefined
  }

  const sanitizationRules = {
    params: page.params ? pickBy(mapValues(page.params, 1), Boolean) : undefined,
    query: page.query ? pickBy(mapValues(page.query, 1), Boolean) : undefined
  }

  const defaults = {
    params: page.params ? pickBy(mapValues(page.params, 2), Boolean) : undefined,
    query: page.query ? pickBy(mapValues(page.query, 2), Boolean) : undefined
  }

  return {
    ...page,
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
          if (validationRules[field]) {
            const validation = await validate(input[field], validationRules[field])
            if (validation.fails()) {
              if (!page[field + 'Error']) {
                throw new Error('BAD_' +
                  field.toUpperCase() +
                  '\n' +
                  (validation.messages() || []).map(v => v.message).join('\n'))
              }
              if (typeof page[field + 'Error'] === 'object') throw page[field + 'Error']
              if (typeof page[field + 'Error'] === 'function') return page[field + 'Error']({ query, params, auth, originals, validation })
            }
          }
          if (sanitizationRules[field]) {
            Object.assign(input[field], sanitize(input[field], sanitizationRules[field]))
          }
          if (defaults[field]) {
            Object.keys(defaults[field]).forEach(k => {
              if (typeof input[field][k] === 'undefined') {
                input[field][k] = sanitizor[camelCase(defaults[field][k])]()
              }
            })
          }
        }
      }))

      // Validate and fetch files
      const files = {}
      if (page.files) {
        Object.keys(page.files).forEach(key => {
          files[key] = request.file(key, page.files[key])
        })
      }

      return page.handle({
        ...originals[0],
        query,
        params,
        auth,
        files,
        request,
        response
      })
    }
  }
}
