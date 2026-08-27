migrate(
  (app) => {
    // Se a tabela/collection cache_previsao já existir por acaso, recupera ou recria
    try {
      const existing = app.findCollectionByNameOrId('cache_previsao')
      app.delete(existing)
    } catch (_) {}

    const collection = new Collection({
      name: 'cache_previsao',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'ponto_id', type: 'text', required: true },
        { name: 'payload', type: 'json', required: false },
        { name: 'obtido_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cache_previsao_ponto_id ON cache_previsao (ponto_id)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('cache_previsao')
      app.delete(collection)
    } catch (_) {}
  },
)
