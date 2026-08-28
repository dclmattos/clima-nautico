migrate(
  (app) => {
    try {
      app.db().newQuery('DELETE FROM cache_previsao').execute()
    } catch (err) {
      // se não existir a tabela ou falhar, ignora
    }
  },
  (app) => {
    // no rollback needed
  },
)
