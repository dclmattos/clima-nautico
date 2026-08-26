migrate(
  (app) => {
    // 1. pontos
    const pontos = new Collection({
      name: 'pontos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'lat', type: 'number', required: true },
        { name: 'lon', type: 'number', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['abrigado', 'semi', 'aberto'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(pontos)

    // 2. perfis_navegacao
    const perfis = new Collection({
      name: 'perfis_navegacao',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'vento_max_kt', type: 'number', required: true },
        { name: 'rajada_max_kt', type: 'number', required: true },
        { name: 'onda_max_m', type: 'number', required: true },
        { name: 'periodo_min_s', type: 'number', required: false },
        { name: 'chuva_max_mm_h', type: 'number', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(perfis)

    const pontosId = app.findCollectionByNameOrId('pontos').id
    const perfisId = app.findCollectionByNameOrId('perfis_navegacao').id

    // 3. preferencias
    const preferencias = new Collection({
      name: 'preferencias',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'perfil_id',
          type: 'relation',
          required: false,
          collectionId: perfisId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'ponto_favorito_id',
          type: 'relation',
          required: false,
          collectionId: pontosId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'horario_briefing', type: 'text', required: false },
        { name: 'criado_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(preferencias)

    // 4. cache_previsao
    const cachePrevisao = new Collection({
      name: 'cache_previsao',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'ponto_id',
          type: 'relation',
          required: true,
          collectionId: pontosId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'payload', type: 'json', required: true },
        { name: 'obtido_em', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_cache_ponto_obtido ON cache_previsao (ponto_id, obtido_em DESC)'],
    })
    app.save(cachePrevisao)
  },
  (app) => {
    const collections = ['cache_previsao', 'preferencias', 'perfis_navegacao', 'pontos']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
