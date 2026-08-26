migrate(
  (app) => {
    const pontosCol = app.findCollectionByNameOrId('pontos')
    const perfisCol = app.findCollectionByNameOrId('perfis_navegacao')

    // Seeds de pontos (angra, abraao, paraty, juatinga)
    const pontosSeed = [
      { nome: 'angra', lat: -23.005, lon: -44.318, tipo: 'abrigado' },
      { nome: 'abraao', lat: -23.14, lon: -44.168, tipo: 'semi' },
      { nome: 'paraty', lat: -23.22, lon: -44.7, tipo: 'abrigado' },
      { nome: 'juatinga', lat: -23.3, lon: -44.5, tipo: 'aberto' },
    ]

    for (const item of pontosSeed) {
      try {
        app.findFirstRecordByData('pontos', 'nome', item.nome)
      } catch (_) {
        const record = new Record(pontosCol)
        record.set('nome', item.nome)
        record.set('lat', item.lat)
        record.set('lon', item.lon)
        record.set('tipo', item.tipo)
        app.save(record)
      }
    }

    // Seeds de perfis_navegacao (lancha, veleiro, jet)
    const perfisSeed = [
      {
        nome: 'lancha',
        vento_max_kt: 15,
        rajada_max_kt: 22,
        onda_max_m: 1.0,
        periodo_min_s: null,
        chuva_max_mm_h: 4,
      },
      {
        nome: 'veleiro',
        vento_max_kt: 22,
        rajada_max_kt: 28,
        onda_max_m: 1.5,
        periodo_min_s: 6,
        chuva_max_mm_h: 6,
      },
      {
        nome: 'jet',
        vento_max_kt: 12,
        rajada_max_kt: 18,
        onda_max_m: 0.6,
        periodo_min_s: null,
        chuva_max_mm_h: 2,
      },
    ]

    for (const item of perfisSeed) {
      try {
        app.findFirstRecordByData('perfis_navegacao', 'nome', item.nome)
      } catch (_) {
        const record = new Record(perfisCol)
        record.set('nome', item.nome)
        record.set('vento_max_kt', item.vento_max_kt)
        record.set('rajada_max_kt', item.rajada_max_kt)
        record.set('onda_max_m', item.onda_max_m)
        if (item.periodo_min_s !== null && item.periodo_min_s !== undefined) {
          record.set('periodo_min_s', item.periodo_min_s)
        }
        record.set('chuva_max_mm_h', item.chuva_max_mm_h)
        app.save(record)
      }
    }
  },
  (app) => {
    // Rollback seeds if needed
    try {
      const pontos = ['angra', 'abraao', 'paraty', 'juatinga']
      for (const p of pontos) {
        try {
          const r = app.findFirstRecordByData('pontos', 'nome', p)
          app.delete(r)
        } catch (_) {}
      }
      const perfis = ['lancha', 'veleiro', 'jet']
      for (const p of perfis) {
        try {
          const r = app.findFirstRecordByData('perfis_navegacao', 'nome', p)
          app.delete(r)
        } catch (_) {}
      }
    } catch (_) {}
  },
)
