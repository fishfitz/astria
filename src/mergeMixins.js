const mergeArrays = (pageArray, mixinArray) => {
  if (!pageArray && !mixinArray) return undefined
  return [...(mixinArray || []), ...(pageArray || [])]
}

module.exports = (page, mixin) => {
  return {
    headers: mergeArrays(mixin.headers, page.headers),
    params: mergeArrays(mixin.params, page.params),
    paramsError: page.paramsError ? page.paramsError : mixin.paramsError,
    query: mergeArrays(mixin.query, page.query),
    queryError: page.queryError ? page.queryError : mixin.queryError,
    files: mergeArrays(mixin.files, page.files),
    handle (...params) {
      if (mixin.handle && !page.handle) return mixin.handle(...params)
      if (mixin.handle) mixin.handle(...params)
      return page.handle(...params)
    }
  }
}
