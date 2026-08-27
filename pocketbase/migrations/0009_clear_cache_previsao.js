migrate(
  (app) => {
    try {
      const cacheCol = app.findCollectionByNameOrId('cache_previsao')
      app.truncateCollection(cacheCol)
    } catch (_) {}
  },
  (app) => {},
)
