migrate(
  (app) => {
    // PocketBase access rules: null = admin only (blocked for regular/public API access), "" = public
    // 1. pontos: list and view public (""), create, update, delete admin-only (null)
    const pontos = app.findCollectionByNameOrId('pontos')
    pontos.listRule = ''
    pontos.viewRule = ''
    pontos.createRule = null
    pontos.updateRule = null
    pontos.deleteRule = null
    app.save(pontos)

    // 2. perfis_navegacao: list and view public (""), create, update, delete admin-only (null)
    const perfis = app.findCollectionByNameOrId('perfis_navegacao')
    perfis.listRule = ''
    perfis.viewRule = ''
    perfis.createRule = null
    perfis.updateRule = null
    perfis.deleteRule = null
    app.save(perfis)

    // 3. cache_previsao: all rules admin-only (null)
    const cachePrevisao = app.findCollectionByNameOrId('cache_previsao')
    cachePrevisao.listRule = null
    cachePrevisao.viewRule = null
    cachePrevisao.createRule = null
    cachePrevisao.updateRule = null
    cachePrevisao.deleteRule = null
    app.save(cachePrevisao)

    // 4. preferencias: all rules admin-only (null)
    const preferencias = app.findCollectionByNameOrId('preferencias')
    preferencias.listRule = null
    preferencias.viewRule = null
    preferencias.createRule = null
    preferencias.updateRule = null
    preferencias.deleteRule = null
    app.save(preferencias)
  },
  (app) => {
    // Revert para as regras padrão anteriores
    const pontos = app.findCollectionByNameOrId('pontos')
    pontos.listRule = ''
    pontos.viewRule = ''
    pontos.createRule = "@request.auth.id != ''"
    pontos.updateRule = "@request.auth.id != ''"
    pontos.deleteRule = "@request.auth.id != ''"
    app.save(pontos)

    const perfis = app.findCollectionByNameOrId('perfis_navegacao')
    perfis.listRule = ''
    perfis.viewRule = ''
    perfis.createRule = "@request.auth.id != ''"
    perfis.updateRule = "@request.auth.id != ''"
    perfis.deleteRule = "@request.auth.id != ''"
    app.save(perfis)

    const cachePrevisao = app.findCollectionByNameOrId('cache_previsao')
    cachePrevisao.listRule = ''
    cachePrevisao.viewRule = ''
    cachePrevisao.createRule = ''
    cachePrevisao.updateRule = ''
    cachePrevisao.deleteRule = ''
    app.save(cachePrevisao)

    const preferencias = app.findCollectionByNameOrId('preferencias')
    preferencias.listRule = ''
    preferencias.viewRule = ''
    preferencias.createRule = ''
    preferencias.updateRule = ''
    preferencias.deleteRule = ''
    app.save(preferencias)
  },
)
