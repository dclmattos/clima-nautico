migrate(
  (app) => {
    // 1. Adicionar campo dispositivo_uuid em preferencias
    const preferenciasCol = app.findCollectionByNameOrId('preferencias')
    if (!preferenciasCol.fields.getByName('dispositivo_uuid')) {
      preferenciasCol.fields.add(
        new TextField({
          name: 'dispositivo_uuid',
          type: 'text',
          required: false,
        }),
      )
      app.save(preferenciasCol)
    }

    // 2. Modificar cache_previsao para permitir ponto_id como texto composto (ex: "ponto_id|janelas|perfil_id")
    // O campo anterior era relation com pontos, que rejeita strings compostas com pipes.
    // Usamos raw SQL no SQLite para atualizar o tipo ou recriar a coluna com segurança sem perder dados
    const cacheCol = app.findCollectionByNameOrId('cache_previsao')
    const existingField = cacheCol.fields.getByName('ponto_id')
    if (existingField && existingField.type === 'relation') {
      cacheCol.fields.removeByName('ponto_id')
      cacheCol.fields.add(
        new TextField({
          name: 'ponto_id',
          type: 'text',
          required: true,
        }),
      )
      app.save(cacheCol)
    }
  },
  (app) => {
    try {
      const preferenciasCol = app.findCollectionByNameOrId('preferencias')
      preferenciasCol.fields.removeByName('dispositivo_uuid')
      app.save(preferenciasCol)
    } catch (_) {}
  },
)
