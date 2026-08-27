migrate(
  (app) => {
    const nomeMap = {
      angra: 'Angra dos Reis',
      abraao: 'Abraão',
      paraty: 'Paraty',
      juatinga: 'Juatinga',
    }

    const records = app.findRecordsByFilter('pontos', '', 'created', 100, 0)
    for (const record of records) {
      const slug = (record.get('slug') || record.get('nome') || '').toLowerCase().trim()
      if (nomeMap[slug]) {
        record.set('nome', nomeMap[slug])
        if (!record.get('slug')) {
          record.set('slug', slug)
        }
        app.save(record)
      }
    }

    // Limpa cache_previsao antigo para refletir novos nomes imediatamente
    try {
      const cacheCol = app.findCollectionByNameOrId('cache_previsao')
      app.truncateCollection(cacheCol)
    } catch (_) {}
  },
  (app) => {
    const rollbackMap = {
      'Angra dos Reis': 'angra',
      Abraão: 'abraao',
      Paraty: 'paraty',
      Juatinga: 'juatinga',
    }

    const records = app.findRecordsByFilter('pontos', '', 'created', 100, 0)
    for (const record of records) {
      const nome = record.get('nome')
      if (rollbackMap[nome]) {
        record.set('nome', rollbackMap[nome])
        app.save(record)
      }
    }
  },
)
