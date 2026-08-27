migrate(
  (app) => {
    const pontosCol = app.findCollectionByNameOrId('pontos')

    // 1. Adicionar campo slug se não existir
    if (!pontosCol.fields.getByName('slug')) {
      pontosCol.fields.add(
        new TextField({
          name: 'slug',
          type: 'text',
          required: false,
        }),
      )
      app.save(pontosCol)
    }

    // 2. Preencher o campo slug com os valores conforme os seeds existentes
    const slugMap = {
      angra: 'angra',
      abraao: 'abraao',
      paraty: 'paraty',
      juatinga: 'juatinga',
    }

    const records = app.findRecordsByFilter('pontos', '', 'created', 100, 0)
    for (const record of records) {
      const nome = (record.get('nome') || '').toLowerCase().trim()
      const slugVal = slugMap[nome] || nome
      record.set('slug', slugVal)
      app.save(record)
    }
  },
  (app) => {
    try {
      const pontosCol = app.findCollectionByNameOrId('pontos')
      pontosCol.fields.removeByName('slug')
      app.save(pontosCol)
    } catch (_) {}
  },
)
