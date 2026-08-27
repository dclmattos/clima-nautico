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
    if (rawTipo === 'semi' || rawTipo === 'semi-abrigado' || rawTipo === 'semi_abrigado') {
      pontoTipo = 'semi-abrigado'
    } else if (
      rawTipo === 'aberto' ||
      rawTipo === 'mar aberto' ||
      rawTipo === 'mar-aberto' ||
      rawTipo === 'mar_aberto'
    ) {
      pontoTipo = 'mar_aberto'
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
    const rawPontoTipo = (ponto.get('tipo') || 'abrigado').trim().toLowerCase()
    if (
      rawPontoTipo === 'semi' ||
      rawPontoTipo === 'semi-abrigado' ||
      rawPontoTipo === 'semi_abrigado'
    ) {
      pontoTipo = 'semi-abrigado'
    } else if (
      rawPontoTipo === 'aberto' ||
      rawPontoTipo === 'mar aberto' ||
      rawPontoTipo === 'mar-aberto' ||
      rawPontoTipo === 'mar_aberto'
    ) {
      pontoTipo = 'mar_aberto'
    } else {
      pontoTipo = 'abrigado'
    }
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
    '&hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction' +
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
  const dailySunInfo = []
  if (weatherData.daily && weatherData.daily.time) {
    const dTimes = weatherData.daily.time
    const dSunrises = weatherData.daily.sunrise || []
    const dSunsets = weatherData.daily.sunset || []
    for (let i = 0; i < dTimes.length; i++) {
      const dayKey = dTimes[i]
      const sRise = dSunrises[i] || null
      const sSet = dSunsets[i] || null
      sunMap[dayKey] = {
        sunriseIso: sRise,
        sunsetIso: sSet,
        sunrise: sRise ? new Date(sRise).getTime() : null,
        sunset: sSet ? new Date(sSet).getTime() : null,
      }
      dailySunInfo.push({
        date: dayKey,
        nascer_sol: sRise,
        por_sol: sSet,
      })
    }
  }

  // Helper para verificar período diurno real baseado em nascer_sol e por_sol de cada dia
  const isDaylightHour = (timeIso) => {
    const hourTime = new Date(timeIso).getTime()
    const dayKey = timeIso.slice(0, 10)
    const daySun = sunMap[dayKey]
    if (daySun && daySun.sunrise && daySun.sunset) {
      return hourTime >= daySun.sunrise && hourTime <= daySun.sunset
    }
    const hour = new Date(timeIso).getHours()
    return hour >= 6 && hour < 18
  }

  // Fator de abrigo conforme o tipo do ponto:
  // abrigado -> 0.4, semi-abrigado -> 0.7, mar_aberto -> 1.0
  let fatorAbrigo = 1.0
  if (pontoTipo === 'abrigado') {
    fatorAbrigo = 0.4
  } else if (pontoTipo === 'semi-abrigado' || pontoTipo === 'semi') {
    fatorAbrigo = 0.7
  } else {
    fatorAbrigo = 1.0
  }
  const isWaveAjustado = fatorAbrigo < 1.0

  // Map de dados marítimos por hora (time)
  const marineMap = {}
  if (marineData && marineData.hourly && marineData.hourly.time) {
    const mTimes = marineData.hourly.time
    const mWaveHeight = marineData.hourly.wave_height || []
    const mWavePeriod = marineData.hourly.wave_period || []
    const mSeaLevel = marineData.hourly.sea_level_height_msl || []
    const mSeaSurfaceTemp = marineData.hourly.sea_surface_temperature || []
    const mSwellWaveHeight = marineData.hourly.swell_wave_height || []
    const mSwellWaveDir = marineData.hourly.swell_wave_direction || []
    const mSwellWavePeriod = marineData.hourly.swell_wave_period || []
    const mWindWaveHeight = marineData.hourly.wind_wave_height || []
    const mOceanCurrentVel = marineData.hourly.ocean_current_velocity || []
    const mOceanCurrentDir = marineData.hourly.ocean_current_direction || []

    for (let i = 0; i < mTimes.length; i++) {
      const t = mTimes[i]
      const rawWaveH = mWaveHeight[i] !== undefined ? mWaveHeight[i] : null
      const rawSwellH = mSwellWaveHeight[i] !== undefined ? mSwellWaveHeight[i] : null

      const adjWaveH = rawWaveH !== null ? Math.round(rawWaveH * fatorAbrigo * 100) / 100 : null
      const adjSwellH = rawSwellH !== null ? Math.round(rawSwellH * fatorAbrigo * 100) / 100 : null

      marineMap[t] = {
        wave_height_bruto: rawWaveH,
        wave_height: adjWaveH,
        wave_ajustado: isWaveAjustado,
        fator_abrigo: fatorAbrigo,
        wave_period: mWavePeriod[i] !== undefined ? mWavePeriod[i] : null,
        sea_level_height_msl: mSeaLevel[i] !== undefined ? mSeaLevel[i] : null,
        sea_surface_temperature: mSeaSurfaceTemp[i] !== undefined ? mSeaSurfaceTemp[i] : null,
        swell_wave_height_bruto: rawSwellH,
        swell_wave_height: adjSwellH,
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
  if (pontoTipo === 'semi' || pontoTipo === 'semi-abrigado') {
    exposicaoDeducao = 10
  } else if (pontoTipo === 'aberto' || pontoTipo === 'mar_aberto') {
    exposicaoDeducao = 20
  }

  const hourlyScores = []

  for (let i = 0; i < wTimes.length; i++) {
    const t = wTimes[i]
    const mData = marineMap[t] || {
      wave_height_bruto: null,
      wave_height: null,
      wave_ajustado: isWaveAjustado,
      fator_abrigo: fatorAbrigo,
      wave_period: null,
      sea_level_height_msl: null,
      sea_surface_temperature: null,
      swell_wave_height_bruto: null,
      swell_wave_height: null,
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
      wave_height_bruto: mData.wave_height_bruto,
      wave_height: waveHeight,
      wave_ajustado: isWaveAjustado,
      fator_abrigo: fatorAbrigo,
      wave_period: wavePeriod,
      sea_level_height_msl: seaLevel,
      sea_surface_temperature: mData.sea_surface_temperature,
      swell_wave_height_bruto: mData.swell_wave_height_bruto,
      swell_wave_height: mData.swell_wave_height,
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

      const inicioIso = currentJanela[0].time
      const fimIso = currentJanela[currentJanela.length - 1].time
      const duracaoHorasReal =
        Math.round((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / (3600 * 1000)) + 1

      janelas.push({
        inicio: inicioIso,
        fim: fimIso,
        duracao_horas: duracaoHorasReal,
        score_medio: Math.round(somaScores / currentJanela.length),
        fator_limitante: maisFrequente,
        fator_limitante_desc: limitanteDesc,
        melhor_janela: false,
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

  // Define melhor_janela: true APENAS na janela de maior score_medio do ponto.
  // Em empate, a primeira (mais cedo) leva o selo.
  if (janelas.length > 0) {
    let maxScoreMedio = -1
    let bestIdx = 0
    for (let j = 0; j < janelas.length; j++) {
      if (janelas[j].score_medio > maxScoreMedio) {
        maxScoreMedio = janelas[j].score_medio
        bestIdx = j
      }
    }
    janelas[bestIdx].melhor_janela = true
  }

  const resultPayload = {
    ponto_id: realPontoId,
    ponto_nome: pontoNome,
    ponto_tipo: pontoTipo,
    perfil_id: realPerfilId,
    perfil_nome: perfilNome,
    dias_sol: dailySunInfo,
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
