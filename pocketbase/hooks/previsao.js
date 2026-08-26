routerAdd('GET', '/backend/v1/previsao', (e) => {
  const pontoId = e.requestInfo().query['ponto_id']

  if (!pontoId) {
    return e.json(400, { error: "Parâmetro 'ponto_id' é obrigatório" })
  }

  // 1. Busca o ponto no PocketBase (por id ou pelo campo nome caso passado slug como "angra")
  let ponto
  try {
    ponto = $app.findRecordById('pontos', pontoId)
  } catch (err) {
    try {
      ponto = $app.findFirstRecordByData('pontos', 'nome', pontoId)
    } catch (err2) {
      return e.json(404, { error: 'Ponto não encontrado: ' + pontoId })
    }
  }

  const lat = ponto.get('lat')
  const lon = ponto.get('lon')

  // 2. Verifica se existe cache_previsao para esse ponto_id com obtido_em < 30 minutos atrás
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().replace('T', ' ')
  try {
    const cachedRecords = $app.findRecordsByFilter(
      'cache_previsao',
      "ponto_id = '" + pontoId + "' && obtido_em >= '" + thirtyMinutesAgo + "'",
      '-obtido_em',
      1,
      0,
    )

    if (cachedRecords && cachedRecords.length > 0) {
      const cached = cachedRecords[0]
      const payload = cached.get('payload')
      if (payload) {
        return e.json(200, payload)
      }
    }
  } catch (cacheErr) {
    // Se a busca no cache falhar por algum motivo, prossegue para buscar na API
  }

  // 3. Consulta endpoints do Open-Meteo
  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility' +
    '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=1'

  const marineUrl =
    'https://marine-api.open-meteo.com/v1/marine?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wave_height,wave_period,sea_level_height_msl' +
    '&timezone=America%2FSao_Paulo&forecast_days=1'

  let weatherRes
  let marineRes

  try {
    weatherRes = $http.send({
      url: weatherUrl,
      method: 'GET',
      timeout: 15,
    })
  } catch (err) {
    return e.json(502, {
      error:
        'Falha ao conectar na API de previsão do tempo: ' +
        (err && err.message ? err.message : String(err)),
    })
  }

  if (weatherRes.statusCode !== 200) {
    return e.json(502, {
      error: 'API de previsão do tempo retornou status ' + weatherRes.statusCode,
    })
  }

  try {
    marineRes = $http.send({
      url: marineUrl,
      method: 'GET',
      timeout: 15,
    })
  } catch (err) {
    return e.json(502, {
      error:
        'Falha ao conectar na API marítima: ' + (err && err.message ? err.message : String(err)),
    })
  }

  if (marineRes.statusCode !== 200) {
    return e.json(502, { error: 'API marítima retornou status ' + marineRes.statusCode })
  }

  const weatherData = weatherRes.json
  const marineData = marineRes.json

  if (!weatherData || !weatherData.hourly || !weatherData.hourly.time) {
    return e.json(502, { error: 'Dados meteorológicos inválidos ou incompletos' })
  }

  // Map de dados marítimos por hora (time)
  const marineMap = {}
  if (marineData && marineData.hourly && marineData.hourly.time) {
    const mTimes = marineData.hourly.time
    const mWaveHeight = marineData.hourly.wave_height || []
    const mWavePeriod = marineData.hourly.wave_period || []
    const mSeaLevel = marineData.hourly.sea_level_height_msl || []

    for (let i = 0; i < mTimes.length; i++) {
      const t = mTimes[i]
      marineMap[t] = {
        wave_height: mWaveHeight[i] !== undefined ? mWaveHeight[i] : null,
        wave_period: mWavePeriod[i] !== undefined ? mWavePeriod[i] : null,
        sea_level_height_msl: mSeaLevel[i] !== undefined ? mSeaLevel[i] : null,
      }
    }
  }

  // Une os dois JSONs pelo campo time
  const wTimes = weatherData.hourly.time
  const wWindSpeed = weatherData.hourly.wind_speed_10m || []
  const wWindDir = weatherData.hourly.wind_direction_10m || []
  const wWindGusts = weatherData.hourly.wind_gusts_10m || []
  const wPrecipitation = weatherData.hourly.precipitation || []
  const wVisibility = weatherData.hourly.visibility || []

  const mergedHourly = []

  for (let i = 0; i < wTimes.length; i++) {
    const t = wTimes[i]
    const mData = marineMap[t] || {
      wave_height: null,
      wave_period: null,
      sea_level_height_msl: null,
    }

    mergedHourly.push({
      time: t,
      wind_speed_10m: wWindSpeed[i] !== undefined ? wWindSpeed[i] : null,
      wind_direction_10m: wWindDir[i] !== undefined ? wWindDir[i] : null,
      wind_gusts_10m: wWindGusts[i] !== undefined ? wWindGusts[i] : null,
      precipitation: wPrecipitation[i] !== undefined ? wPrecipitation[i] : null,
      visibility: wVisibility[i] !== undefined ? wVisibility[i] : null,
      wave_height: mData.wave_height,
      wave_period: mData.wave_period,
      sea_level_height_msl: mData.sea_level_height_msl,
    })
  }

  const resultPayload = {
    ponto_id: pontoId,
    ponto_nome: ponto.get('nome'),
    ponto_tipo: ponto.get('tipo'),
    lat: lat,
    lon: lon,
    timezone: weatherData.timezone || 'America/Sao_Paulo',
    hourly: mergedHourly,
  }

  // 4. Salva no cache_previsao
  try {
    const cacheCol = $app.findCollectionByNameOrId('cache_previsao')
    const cacheRecord = new Record(cacheCol)
    const nowIso = new Date().toISOString().replace('T', ' ')

    cacheRecord.set('ponto_id', pontoId)
    cacheRecord.set('payload', resultPayload)
    cacheRecord.set('obtido_em', nowIso)

    $app.save(cacheRecord)
  } catch (saveErr) {
    // Log se necessário, mas devolve o payload mesmo se o cache falhar ao salvar
  }

  return e.json(200, resultPayload)
})
