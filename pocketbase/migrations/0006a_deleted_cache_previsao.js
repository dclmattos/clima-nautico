/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2986983124')

    return app.delete(collection)
  },
  (app) => {
    const collection = new Collection({
      createRule: null,
      deleteRule: null,
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          help: '',
          hidden: false,
          id: 'text3208210256',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          presentable: false,
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          cascadeDelete: true,
          collectionId: 'pbc_905520866',
          help: '',
          hidden: false,
          id: 'relation1885708711',
          maxSelect: 1,
          minSelect: 0,
          name: 'ponto_id',
          presentable: false,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          help: '',
          hidden: false,
          id: 'json1110206997',
          maxSize: 0,
          name: 'payload',
          presentable: false,
          required: true,
          system: false,
          type: 'json',
        },
        {
          help: '',
          hidden: false,
          id: 'date2204076773',
          max: '',
          min: '',
          name: 'obtido_em',
          presentable: false,
          required: true,
          system: false,
          type: 'date',
        },
        {
          hidden: false,
          id: 'autodate2990389176',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate3332085495',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      id: 'pbc_2986983124',
      indexes: ['CREATE INDEX idx_cache_ponto_obtido ON cache_previsao (ponto_id, obtido_em DESC)'],
      listRule: null,
      name: 'cache_previsao',
      system: false,
      type: 'base',
      updateRule: null,
      viewRule: null,
    })

    return app.save(collection)
  },
)
