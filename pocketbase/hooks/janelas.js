routerAdd('GET', '/backend/v1/janelas', (e) => {
  const query = e.requestInfo().query || {}
  const pontoIdParam = query['ponto_id']
  const perfilIdParam = query['perfil_id']
  const latParam = query['lat']
  const lonParam = query['lon']
  const tipoParam = query['tipo']
  const nomeParam = query['nome']

  if (!perfilIdParam) {
    return e.json(400, { error: "Parâmetro 'perfil_id' é obrigatório" })
  }

  // 1. Busca o perfil no PocketBase (por id ou pelo campo nome)
  let perfil
  try {
    perfil = $app.findRecordById('perfis_navegacao', perfilIdParam)
  } catch (err) {
    try {
      perfil = $app.findFirstRecordByData('perfis_navegacao', 'nome', perfilIdParam)
    } catch (err2) {
      return e.json(404, { error: 'Perfil não encontrado: ' + perfilIdParam })
    }
  }

  const realPerfilId = perfil.id || perfilIdParam
  const perfilNome = perfil.get('nome') || perfilIdParam

  let realPontoId = ''
  let pontoNome = ''
  let lat = null
  let lon = null
  let pontoTipo = 'abrigado'

  if (latParam !== undefined && lonParam !== undefined) {
    const parsedLat = parseFloat(latParam)
    const parsedLon = parseFloat(lonParam)

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      return e.json(400, { error: 'Coordenadas lat/lon inválidas' })
    }

    lat = parsedLat
    lon = parsedLon
    const latFormatted = lat.toFixed(3)
    const lonFormatted = lon.toFixed(3)
    realPontoId = 'custom:' + latFormatted + ':' + lonFormatted
    pontoNome = (nomeParam || '').trim() || 'Ponto Personalizado'

    const rawTipo = (tipoParam || '').trim().toLowerCase()
    if (rawTipo === 'semi' || rawTipo === 'semi-abrigado') {
      pontoTipo = 'semi'
    } else if (rawTipo === 'aberto' || rawTipo === 'mar aberto' || rawTipo === 'mar-aberto') {
      pontoTipo = 'aberto'
    } else {
      pontoTipo = 'abrigado'
    }
  } else if (pontoIdParam) {
    let ponto
    try {
      ponto = $app.findRecordById('pontos', pontoIdParam)
    } catch (err) {
      try {
        ponto = $app.findFirstRecordByData('pontos', 'slug', pontoIdParam)
      } catch (errSlug) {
        try {
          ponto = $app.findFirstRecordByData('pontos', 'nome', pontoIdParam)
        } catch (errNome) {
          return e.json(404, { error: 'Ponto não encontrado: ' + pontoIdParam })
        }
      }
    }

    realPontoId = ponto.id || pontoIdParam
    pontoNome = ponto.get('nome')
    lat = ponto.get('lat')
    lon = ponto.get('lon')
    pontoTipo = ponto.get('tipo') || 'abrigado'
  } else {
    return e.json(400, { error: "Informe 'ponto_id' ou as coordenadas 'lat', 'lon' e 'tipo'" })
  }

  const perfilVentoMax = Number(perfil.get('vento_max_kt')) || 15
  const perfilRajadaMax = Number(perfil.get('rajada_max_kt')) || 22
  const perfilOndaMax = Number(perfil.get('onda_max_m')) || 1.0
  const rawPeriodoMin = perfil.get('periodo_min_s')
  const perfilPeriodoMin =
    rawPeriodoMin !== null && rawPeriodoMin !== undefined && Number(rawPeriodoMin) > 0
      ? Number(rawPeriodoMin)
      : null
  const perfilChuvaMax = Number(perfil.get('chuva_max_mm_h')) || 4.0

  // 3. Cache: chave realPontoId + "|janelas|" + realPerfilId
  const cacheKey = realPontoId + '|janelas|' + realPerfilId
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().replace('T', ' ')
  try {
    const cachedRecords = $app.findRecordsByFilter(
      'cache_previsao',
      "ponto_id = '" + cacheKey + "' && obtido_em >= '" + thirtyMinutesAgo + "'",
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
    // Continua se cache falhar
  }

  // 4. Consulta endpoints do Open-Meteo com forecast_days=3 (72 horas)
  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility,temperature_2m,surface_pressure,cloud_cover,uv_index' +
    '&daily=sunrise,sunset,daylight_duration' +
    '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=3'

  const marineUrl =
    'https://marine-api.open-meteo.com/v1/marine?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature,swell_wave_direction,swell_wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction' +
    '&timezone=America%2FSao_Paulo&forecast_days=3'

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

  // Verificação de erro da API Marine (terra)
  if (
    marineRes.statusCode === 400 ||
    marineRes.statusCode === 404 ||
    marineRes.statusCode === 422
  ) {
    return e.json(400, {
      error: 'esta posição parece estar em terra — ajuste para o mar',
      detail: marineRes.json || marineRes.body,
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

  const mHourly = marineData && marineData.hourly ? marineData.hourly : null
  if (!mHourly || !mHourly.time || mHourly.time.length === 0) {
    return e.json(400, {
      error: 'esta posição parece estar em terra — ajuste para o mar',
    })
  }

  // Mapeamento diário de sunrise e sunset por data (YYYY-MM-DD)
  const sunMap = {}
  if (weatherData.daily && weatherData.daily.time) {
    const dTimes = weatherData.daily.time
    const dSunrises = weatherData.daily.sunrise || []
    const dSunsets = weatherData.daily.sunset || []
    for (let i = 0; i < dTimes.length; i++) {
      const dayKey = dTimes[i]
      sunMap[dayKey] = {
        sunrise: dSunrises[i] ? new Date(dSunrises[i]).getTime() : null,
        sunset: dSunsets[i] ? new Date(dSunsets[i]).getTime() : null,
      }
    }
  }

  // Helper para verificar período diurno
  const isDaylightHour = (timeIso) => {
    const hourTime = new Date(timeIso).getTime()
    const dayKey = timeIso.slice(0, 10)
    const daySun = sunMap[dayKey]
    if (daySun && daySun.sunrise && daySun.sunset) {
      return (
        hourTime >= daySun.sunrise - 30 * 60 * 1000 && hourTime <= daySun.sunset + 30 * 60 * 1000
      )
    }
    const hour = new Date(timeIso).getHours()
    return hour >= 6 && hour < 18
  }

  // Map de dados marítimos por hora (time)
  const marineMap = {}
  if (marineData && marineData.hourly && marineData.hourly.time) {
    const mTimes = marineData.hourly.time
    const mWaveHeight = marineData.hourly.wave_height || []
    const mWavePeriod = marineData.hourly.wave_period || []
    const mSeaLevel = marineData.hourly.sea_level_height_msl || []
    const mSeaSurfaceTemp = marineData.hourly.sea_surface_temperature || []
    const mSwellWaveDir = marineData.hourly.swell_wave_direction || []
    const mSwellWavePeriod = marineData.hourly.swell_wave_period || []
    const mWindWaveHeight = marineData.hourly.wind_wave_height || []
    const mOceanCurrentVel = marineData.hourly.ocean_current_velocity || []
    const mOceanCurrentDir = marineData.hourly.ocean_current_direction || []

    for (let i = 0; i < mTimes.length; i++) {
      const t = mTimes[i]
      marineMap[t] = {
        wave_height: mWaveHeight[i] !== undefined ? mWaveHeight[i] : null,
        wave_period: mWavePeriod[i] !== undefined ? mWavePeriod[i] : null,
        sea_level_height_msl: mSeaLevel[i] !== undefined ? mSeaLevel[i] : null,
        sea_surface_temperature: mSeaSurfaceTemp[i] !== undefined ? mSeaSurfaceTemp[i] : null,
        swell_wave_direction: mSwellWaveDir[i] !== undefined ? mSwellWaveDir[i] : null,
        swell_wave_period: mSwellWavePeriod[i] !== undefined ? mSwellWavePeriod[i] : null,
        wind_wave_height: mWindWaveHeight[i] !== undefined ? mWindWaveHeight[i] : null,
        ocean_current_velocity: mOceanCurrentVel[i] !== undefined ? mOceanCurrentVel[i] : null,
        ocean_current_direction: mOceanCurrentDir[i] !== undefined ? mOceanCurrentDir[i] : null,
      }
    }
  }

  // Merge e cálculo do score por hora (72h)
  const wTimes = weatherData.hourly.time
  const wWindSpeed = weatherData.hourly.wind_speed_10m || []
  const wWindDir = weatherData.hourly.wind_direction_10m || []
  const wWindGusts = weatherData.hourly.wind_gusts_10m || []
  const wPrecipitation = weatherData.hourly.precipitation || []
  const wVisibility = weatherData.hourly.visibility || []
  const wTemp = weatherData.hourly.temperature_2m || []
  const wPressure = weatherData.hourly.surface_pressure || []
  const wCloudCover = weatherData.hourly.cloud_cover || []
  const wUvIndex = weatherData.hourly.uv_index || []

  // Dedução de exposição: abrigado = 0, semi = -10, aberto = -20
  let exposicaoDeducao = 0
  if (pontoTipo === 'semi') {
    exposicaoDeducao = 10
  } else if (pontoTipo === 'aberto') {
    exposicaoDeducao = 20
  }

  const hourlyScores = []

  for (let i = 0; i < wTimes.length; i++) {
    const t = wTimes[i]
    const mData = marineMap[t] || {
      wave_height: null,
      wave_period: null,
      sea_level_height_msl: null,
      sea_surface_temperature: null,
      swell_wave_direction: null,
      swell_wave_period: null,
      wind_wave_height: null,
      ocean_current_velocity: null,
      ocean_current_direction: null,
    }

    const windSpeed = wWindSpeed[i] !== undefined ? wWindSpeed[i] : null
    const windDir = wWindDir[i] !== undefined ? wWindDir[i] : null
    const windGusts = wWindGusts[i] !== undefined ? wWindGusts[i] : null
    const precipitation = wPrecipitation[i] !== undefined ? wPrecipitation[i] : null
    const visibility = wVisibility[i] !== undefined ? wVisibility[i] : null
    const waveHeight = mData.wave_height
    const wavePeriod = mData.wave_period
    const seaLevel = mData.sea_level_height_msl

    let score = 100

    let penalidadeVento = 0
    let penalidadeRajada = 0
    let penalidadeOnda = 0
    let penalidadePeriodo = 0
    let penalidadeChuva = 0

    if (windSpeed !== null && windSpeed > perfilVentoMax) {
      penalidadeVento = Math.round(
        Math.min(50, ((windSpeed - perfilVentoMax) / perfilVentoMax) * 50),
      )
    }

    if (windGusts !== null && windGusts > perfilRajadaMax) {
      penalidadeRajada = Math.round(
        Math.min(40, ((windGusts - perfilRajadaMax) / perfilRajadaMax) * 40),
      )
    }

    if (waveHeight !== null && waveHeight > perfilOndaMax) {
      penalidadeOnda = Math.round(
        Math.min(50, ((waveHeight - perfilOndaMax) / (perfilOndaMax * 2)) * 50),
      )
    }

    if (perfilPeriodoMin !== null && wavePeriod !== null && wavePeriod < perfilPeriodoMin) {
      penalidadePeriodo = Math.round(
        Math.min(30, ((perfilPeriodoMin - wavePeriod) / perfilPeriodoMin) * 30),
      )
    }

    if (precipitation !== null && precipitation > perfilChuvaMax) {
      penalidadeChuva = Math.round(
        Math.min(30, ((precipitation - perfilChuvaMax) / perfilChuvaMax) * 30),
      )
    }

    score =
      score -
      penalidadeVento -
      penalidadeRajada -
      penalidadeOnda -
      penalidadePeriodo -
      penalidadeChuva
    score = score - exposicaoDeducao

    if (score < 0) score = 0
    if (score > 100) score = 100

    let fatorLimitante = null
    let fatorLimitanteDesc = null

    if (score < 90) {
      const penalidades = [
        {
          tipo: 'vento',
          valor: penalidadeVento,
          desc: 'vento ' + (windSpeed !== null ? Math.round(windSpeed) : 0) + ' kt',
        },
        {
          tipo: 'rajada',
          valor: penalidadeRajada,
          desc: 'rajada ' + (windGusts !== null ? Math.round(windGusts) : 0) + ' kt',
        },
        {
          tipo: 'onda',
          valor: penalidadeOnda,
          desc: 'onda ' + (waveHeight !== null ? waveHeight.toFixed(1) : 0) + ' m',
        },
        {
          tipo: 'período',
          valor: penalidadePeriodo,
          desc: 'período ' + (wavePeriod !== null ? wavePeriod.toFixed(1) : 0) + ' s',
        },
        {
          tipo: 'chuva',
          valor: penalidadeChuva,
          desc: 'chuva ' + (precipitation !== null ? precipitation.toFixed(1) : 0) + ' mm/h',
        },
      ]

      let maxPen = 0
      let chosen = null
      for (let pIdx = 0; pIdx < penalidades.length; pIdx++) {
        if (penalidades[pIdx].valor > maxPen) {
          maxPen = penalidades[pIdx].valor
          chosen = penalidades[pIdx]
        }
      }

      if (chosen && maxPen > 0) {
        fatorLimitante = chosen.tipo
        fatorLimitanteDesc = chosen.desc
      } else if (exposicaoDeducao > 0) {
        fatorLimitante = 'exposição'
        fatorLimitanteDesc = 'ponto ' + pontoTipo
      }
    }

    hourlyScores.push({
      time: t,
      score: score,
      fator_limitante: fatorLimitante,
      fator_limitante_desc: fatorLimitanteDesc,
      wind_speed_10m: windSpeed,
      wind_direction_10m: windDir,
      wind_gusts_10m: windGusts,
      precipitation: precipitation,
      visibility: visibility,
      temperature_2m: wTemp[i] !== undefined ? wTemp[i] : null,
      surface_pressure: wPressure[i] !== undefined ? wPressure[i] : null,
      cloud_cover: wCloudCover[i] !== undefined ? wCloudCover[i] : null,
      uv_index: wUvIndex[i] !== undefined ? wUvIndex[i] : null,
      wave_height: waveHeight,
      wave_period: wavePeriod,
      sea_level_height_msl: seaLevel,
      sea_surface_temperature: mData.sea_surface_temperature,
      swell_wave_direction: mData.swell_wave_direction,
      swell_wave_period: mData.swell_wave_period,
      wind_wave_height: mData.wind_wave_height,
      ocean_current_velocity: mData.ocean_current_velocity,
      ocean_current_direction: mData.ocean_current_direction,
    })
  }

  // 5. Detecção de janelas ideais
  const janelas = []
  let currentJanela = []

  const finalizeJanela = () => {
    if (currentJanela.length >= 3) {
      let somaScores = 0
      const fatoresCount = {}

      for (let j = 0; j < currentJanela.length; j++) {
        somaScores += currentJanela[j].score
        const f = currentJanela[j].fator_limitante
        if (f) {
          fatoresCount[f] = (fatoresCount[f] || 0) + 1
        }
      }

      let maisFrequente = null
      let maxCount = 0
      const fatorKeys = Object.keys(fatoresCount)
      for (let k = 0; k < fatorKeys.length; k++) {
        const key = fatorKeys[k]
        if (fatoresCount[key] > maxCount) {
          maxCount = fatoresCount[key]
          maisFrequente = key
        }
      }

      let limitanteDesc = null
      if (maisFrequente) {
        for (let j = 0; j < currentJanela.length; j++) {
          if (
            currentJanela[j].fator_limitante === maisFrequente &&
            currentJanela[j].fator_limitante_desc
          ) {
            limitanteDesc = currentJanela[j].fator_limitante_desc
            break
          }
        }
      }

      janelas.push({
        inicio: currentJanela[0].time,
        fim: currentJanela[currentJanela.length - 1].time,
        duracao_horas: currentJanela.length,
        score_medio: Math.round(somaScores / currentJanela.length),
        fator_limitante: maisFrequente,
        fator_limitante_desc: limitanteDesc,
      })
    }
    currentJanela = []
  }

  for (let i = 0; i < hourlyScores.length; i++) {
    const item = hourlyScores[i]
    const isDay = isDaylightHour(item.time)

    if (item.score >= 70 && isDay) {
      currentJanela.push(item)
    } else {
      finalizeJanela()
    }
  }

  finalizeJanela()

  const resultPayload = {
    ponto_id: realPontoId,
    ponto_nome: pontoNome,
    ponto_tipo: pontoTipo,
    perfil_id: realPerfilId,
    perfil_nome: perfilNome,
    hourly_scores: hourlyScores,
    janelas: janelas,
  }

  // 6. Salva no cache_previsao via UPSERT
  const nowIso = new Date().toISOString().replace('T', ' ')
  try {
    const existing = $app.findFirstRecordByData('cache_previsao', 'ponto_id', cacheKey)
    existing.set('payload', resultPayload)
    existing.set('obtido_em', nowIso)
    $app.save(existing)
  } catch (findErr) {
    try {
      const cacheCol = $app.findCollectionByNameOrId('cache_previsao')
      const cacheRecord = new Record(cacheCol)
      cacheRecord.set('ponto_id', cacheKey)
      cacheRecord.set('payload', resultPayload)
      cacheRecord.set('obtido_em', nowIso)
      $app.save(cacheRecord)
    } catch (saveErr) {
      console.log(
        'Erro ao salvar cache_previsao janelas:',
        saveErr && saveErr.message ? saveErr.message : String(saveErr),
      )
    }
  }

  return e.json(200, resultPayload)
})
