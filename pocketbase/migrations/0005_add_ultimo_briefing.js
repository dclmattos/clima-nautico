migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('preferencias')
    if (!col.fields.getByName('ultimo_briefing')) {
      col.fields.add(
        new TextField({
          name: 'ultimo_briefing',
          type: 'text',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('preferencias')
      col.fields.removeByName('ultimo_briefing')
      app.save(col)
    } catch (_) {}
  },
)
