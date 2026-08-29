migrate((app) => {
  try {
    app.db().newQuery('DELETE FROM cache_previsao').execute()
  } catch (err) {
    console.log('Erro ao limpar cache_previsao:', err)
  }
})
