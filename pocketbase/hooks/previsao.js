routerAdd('GET', '/backend/v1/previsao', (e) => {
  const query = e.requestInfo().query || {}
  const pontoIdParam = query['ponto_id']
  const latParam = query['lat']
  const lonParam = query['lon']
  const tipoParam = query['tipo']
  const nomeParam = query['nome']

  let pontoId = ''
  let lat = null
  let lon = null
  let pontoTipo = 'abrigado'
  let pontoNome = ''

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
    pontoId = 'custom:' + latFormatted + ':' + lonFormatted
    pontoNome = (nomeParam || '').trim() || 'Ponto Personalizado'

    // Tipo
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
    // 1. Busca o ponto no PocketBase (por id, por slug ou pelo campo nome caso passado slug como "angra")
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

    pontoId = ponto.id || pontoIdParam
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
  // Forecast: daily=sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_probability_max & hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,visibility,temperature_2m,surface_pressure,cloud_cover,uv_index,weather_code
  const weatherUrl =
    'https://api.open-meteo.com/v1/forecast?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,precipitation_probability,visibility,temperature_2m,surface_pressure,cloud_cover,uv_index,weather_code' +
    '&daily=sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=7'

  // Marine: hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction
  const marineUrl =
    'https://marine-api.open-meteo.com/v1/marine?latitude=' +
    encodeURIComponent(lat) +
    '&longitude=' +
    encodeURIComponent(lon) +
    '&hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction' +
    '&timezone=America%2FSao_Paulo&forecast_days=7'

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

  // Verificação de erro da API Marine (Open-Meteo retorna 400 ou erro quando coordenada está em terra ou fora de água)
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

  // Se a API marine retornar hourly vazio ou wave_height com todos nulos por ser em terra
  const mHourly = marineData && marineData.hourly ? marineData.hourly : null
  if (!mHourly || !mHourly.time || mHourly.time.length === 0) {
    return e.json(400, {
      error: 'esta posição parece estar em terra — ajuste para o mar',
    })
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

  // Helpers de conversão náutica e astronômica definidos inline
  const getBeaufort = (windKt) => {
    if (windKt === null || windKt === undefined || isNaN(windKt)) return 0
    const w = Number(windKt)
    if (w < 1) return 0
    if (w <= 3) return 1
    if (w <= 6) return 2
    if (w <= 10) return 3
    if (w <= 16) return 4
    if (w <= 21) return 5
    if (w <= 27) return 6
    if (w <= 33) return 7
    if (w <= 40) return 8
    if (w <= 47) return 9
    if (w <= 55) return 10
    if (w <= 63) return 11
    return 12
  }

  const getDouglas = (waveM) => {
    if (waveM === null || waveM === undefined || isNaN(waveM))
      return { grau: 0, descricao: 'Calmo (espelhado)' }
    const h = Number(waveM)
    if (h === 0) return { grau: 0, descricao: 'Calmo (espelhado)' }
    if (h <= 0.1) return { grau: 1, descricao: 'Calmo (ondulado)' }
    if (h <= 0.5) return { grau: 2, descricao: 'Cavado suave' }
    if (h <= 1.25) return { grau: 3, descricao: 'Levemente cavado' }
    if (h <= 2.5) return { grau: 4, descricao: 'Moderado' }
    if (h <= 4.0) return { grau: 5, descricao: 'Grosso' }
    if (h <= 6.0) return { grau: 6, descricao: 'Muito grosso' }
    if (h <= 9.0) return { grau: 7, descricao: 'Alto' }
    if (h <= 14.0) return { grau: 8, descricao: 'Muito alto' }
    return { grau: 9, descricao: 'Fenomenal' }
  }

  // Une os dois JSONs pelo campo time
  const wTimes = weatherData.hourly.time
  const wWindSpeed = weatherData.hourly.wind_speed_10m || []
  const wWindDir = weatherData.hourly.wind_direction_10m || []
  const wWindGusts = weatherData.hourly.wind_gusts_10m || []
  const wPrecipitation = weatherData.hourly.precipitation || []
  const wPrecipitationProb = weatherData.hourly.precipitation_probability || []
  const wVisibility = weatherData.hourly.visibility || []
  const wTemp = weatherData.hourly.temperature_2m || []
  const wPressure = weatherData.hourly.surface_pressure || []
  const wCloudCover = weatherData.hourly.cloud_cover || []
  const wUvIndex = weatherData.hourly.uv_index || []
  const wWeatherCode = weatherData.hourly.weather_code || []

  const mergedHourly = []

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

    const windSpd = wWindSpeed[i] !== undefined ? wWindSpeed[i] : null
    const waveH = mData.wave_height

    mergedHourly.push({
      time: t,
      wind_speed_10m: windSpd,
      wind_direction_10m: wWindDir[i] !== undefined ? wWindDir[i] : null,
      wind_gusts_10m: wWindGusts[i] !== undefined ? wWindGusts[i] : null,
      beaufort: windSpd !== null ? getBeaufort(windSpd) : 0,
      precipitation: wPrecipitation[i] !== undefined ? wPrecipitation[i] : null,
      precipitation_probability: wPrecipitationProb[i] !== undefined ? wPrecipitationProb[i] : null,
      visibility: wVisibility[i] !== undefined ? wVisibility[i] : null,
      temperature_2m: wTemp[i] !== undefined ? wTemp[i] : null,
      surface_pressure: wPressure[i] !== undefined ? wPressure[i] : null,
      cloud_cover: wCloudCover[i] !== undefined ? wCloudCover[i] : null,
      uv_index: wUvIndex[i] !== undefined ? wUvIndex[i] : null,
      weather_code: wWeatherCode[i] !== undefined ? wWeatherCode[i] : null,
      wave_height_bruto: mData.wave_height_bruto,
      wave_height: waveH,
      wave_ajustado: isWaveAjustado,
      fator_abrigo: fatorAbrigo,
      wave_period: mData.wave_period,
      douglas_grau: waveH !== null ? getDouglas(waveH).grau : 0,
      sea_level_height_msl: mData.sea_level_height_msl,
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

  // Cálculo da hora atual para métricas de tempo real (pressão, astronomia, mar atual)
  const now = new Date()
  const nowMs = now.getTime()
  let currentIdx = 0
  let minDiff = Infinity
  for (let i = 0; i < mergedHourly.length; i++) {
    const itemTime = new Date(mergedHourly[i].time).getTime()
    const diff = Math.abs(itemTime - nowMs)
    if (diff < minDiff) {
      minDiff = diff
      currentIdx = i
    }
  }

  const currentItem = mergedHourly[currentIdx] || mergedHourly[0] || {}

  // 1. Tendência de Pressão: diferença em hPa entre atual e 3 horas atrás
  let pressaoAtual = currentItem.surface_pressure
  if (pressaoAtual === null || pressaoAtual === undefined) {
    for (let i = currentIdx; i >= 0; i--) {
      if (
        mergedHourly[i].surface_pressure !== null &&
        mergedHourly[i].surface_pressure !== undefined
      ) {
        pressaoAtual = mergedHourly[i].surface_pressure
        break
      }
    }
  }

  let pressao3hAtras = null
  const idx3h = currentIdx - 3
  if (idx3h >= 0 && mergedHourly[idx3h] && mergedHourly[idx3h].surface_pressure !== null) {
    pressao3hAtras = mergedHourly[idx3h].surface_pressure
  } else {
    // Procura a mais próxima de 3h antes
    for (let i = Math.max(0, currentIdx - 3); i >= 0; i--) {
      if (mergedHourly[i].surface_pressure !== null) {
        pressao3hAtras = mergedHourly[i].surface_pressure
        break
      }
    }
  }

  let tendenciaPressaoValor = 0
  let tendenciaPressaoDirecao = 'estável'

  if (pressaoAtual !== null && pressao3hAtras !== null) {
    tendenciaPressaoValor = Math.round((pressaoAtual - pressao3hAtras) * 10) / 10
    if (tendenciaPressaoValor > 0.5) {
      tendenciaPressaoDirecao = 'subindo'
    } else if (tendenciaPressaoValor < -0.5) {
      tendenciaPressaoDirecao = 'descendo'
    } else {
      tendenciaPressaoDirecao = 'estável'
    }
  }

  const pressaoTendencia = {
    atual_hpa: pressaoAtual !== null ? Math.round(pressaoAtual * 10) / 10 : null,
    delta_3h_hpa: tendenciaPressaoValor,
    direcao: tendenciaPressaoDirecao,
    queda_severa: tendenciaPressaoValor <= -3.0,
  }

  // 2. Beaufort e Douglas atuais
  const currentBeaufort =
    currentItem.wind_speed_10m !== null ? getBeaufort(currentItem.wind_speed_10m) : 0
  const currentDouglas =
    currentItem.wave_height !== null
      ? getDouglas(currentItem.wave_height)
      : { grau: 0, descricao: 'Calmo (espelhado)' }

  // 3. Fase e iluminação da Lua (Jean Meeus / Astronomical Algorithms)
  const getMoonData = (date) => {
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    const day = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24

    let y = year
    let m = month
    if (m <= 2) {
      y -= 1
      m += 12
    }
    const a = Math.floor(y / 100)
    const b = 2 - a + Math.floor(a / 4)
    const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5

    const T = (jd - 2451545.0) / 36525.0

    let D =
      297.8501921 +
      445267.1114034 * T -
      0.0018819 * T * T +
      (T * T * T) / 545868.0 -
      (T * T * T * T) / 113065000.0
    let M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24490000.0
    let Mprime =
      134.9633964 +
      477198.8675055 * T +
      0.0087414 * T * T +
      (T * T * T) / 69699.0 -
      (T * T * T * T) / 14712000.0

    const deg2rad = Math.PI / 180.0
    let phaseAngleDeg =
      180 -
      D -
      6.289 * Math.sin(Mprime * deg2rad) +
      2.1 * Math.sin(M * deg2rad) -
      1.274 * Math.sin((2 * D - Mprime) * deg2rad) -
      0.658 * Math.sin(2 * D * deg2rad) -
      0.214 * Math.sin(2 * Mprime * deg2rad) -
      0.11 * Math.sin(D * deg2rad)

    D = ((D % 360) + 360) % 360
    const phaseValue = D / 360.0

    let iRad = phaseAngleDeg * deg2rad
    let fraction = (1 + Math.cos(iRad)) / 2.0
    let illuminationPct = Math.round(fraction * 100)
    if (illuminationPct < 0) illuminationPct = 0
    if (illuminationPct > 100) illuminationPct = 100

    let nomeFase = 'Nova'
    let icone = '🌑'

    if (phaseValue >= 0.97 || phaseValue < 0.03) {
      nomeFase = 'Nova'
      icone = '🌑'
    } else if (phaseValue >= 0.03 && phaseValue < 0.22) {
      nomeFase = 'Crescente'
      icone = '🌒'
    } else if (phaseValue >= 0.22 && phaseValue < 0.28) {
      nomeFase = 'Quarto Crescente'
      icone = '🌓'
    } else if (phaseValue >= 0.28 && phaseValue < 0.47) {
      nomeFase = 'Gibosa Crescente'
      icone = '🌔'
    } else if (phaseValue >= 0.47 && phaseValue < 0.53) {
      nomeFase = 'Cheia'
      icone = '🌕'
    } else if (phaseValue >= 0.53 && phaseValue < 0.72) {
      nomeFase = 'Gibosa Minguante'
      icone = '🌖'
    } else if (phaseValue >= 0.72 && phaseValue < 0.78) {
      nomeFase = 'Quarto Minguante'
      icone = '🌗'
    } else {
      nomeFase = 'Minguante'
      icone = '🌘'
    }

    return {
      fase: Math.round(phaseValue * 1000) / 1000,
      iluminacao_porcentagem: illuminationPct,
      nome_fase: nomeFase,
      icone: icone,
    }
  }

  const moonData = getMoonData(now)

  // 4. Crepúsculo Náutico matutino e vespertino (sol 12° abaixo do horizonte -> zenith = 102°)
  const getNauticalTwilight = (date, latitude, longitude) => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()

    const rad = Math.PI / 180.0
    const deg = 180.0 / Math.PI

    const N1 = Math.floor((275 * month) / 9)
    const N2 = Math.floor((month + 9) / 12)
    const N3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3)
    const N = N1 - N2 * N3 + day - 30

    const lngHour = longitude / 15.0

    const calcTime = (isMorning) => {
      const t = isMorning ? N + (6.0 - lngHour) / 24.0 : N + (18.0 - lngHour) / 24.0
      const M = 0.9856 * t - 3.289
      let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634
      L = ((L % 360) + 360) % 360

      let RA = deg * Math.atan(0.91764 * Math.tan(L * rad))
      RA = ((RA % 360) + 360) % 360

      const Lquadrant = Math.floor(L / 90) * 90
      const RAquadrant = Math.floor(RA / 90) * 90
      RA = RA + (Lquadrant - RAquadrant)
      RA = RA / 15.0

      const sinDec = 0.39782 * Math.sin(L * rad)
      const cosDec = Math.cos(Math.asin(sinDec))

      const zenith = 102.0
      const cosH =
        (Math.cos(zenith * rad) - sinDec * Math.sin(latitude * rad)) /
        (cosDec * Math.cos(latitude * rad))

      if (cosH > 1 || cosH < -1) return null

      let H
      if (isMorning) {
        H = 360.0 - deg * Math.acos(cosH)
      } else {
        H = deg * Math.acos(cosH)
      }
      H = H / 15.0

      const T = H + RA - 0.06571 * t - 6.622
      let UT = T - lngHour
      UT = ((UT % 24) + 24) % 24

      const localHours = UT - 3.0
      const adjustedHours = ((localHours % 24) + 24) % 24

      const h = Math.floor(adjustedHours)
      const min = Math.floor((adjustedHours - h) * 60)

      const yStr = String(year)
      const mStr = String(month).padStart(2, '0')
      const dStr = String(day).padStart(2, '0')
      const hStr = String(h).padStart(2, '0')
      const minStr = String(min).padStart(2, '0')

      return `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:00-03:00`
    }

    return {
      crepusculo_nautico_matutino: calcTime(true),
      crepusculo_nautico_vespertino: calcTime(false),
    }
  }

  const twilight = getNauticalTwilight(now, lat, lon)

  // 5. Distância e rumo verdadeiro para os 4 pontos canônicos
  const PONTOS_CANONICOS = [
    { slug: 'angra', nome: 'Angra dos Reis', lat: -23.0067, lon: -44.318 },
    { slug: 'abraao', nome: 'Abraão (Ilha Grande)', lat: -23.1415, lon: -44.1676 },
    { slug: 'paraty', nome: 'Paraty', lat: -23.2178, lon: -44.7131 },
    { slug: 'juatinga', nome: 'Juatinga', lat: -23.2833, lon: -44.5833 },
  ]

  const getCardinalLabel = (degVal) => {
    const dirs = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ]
    const idx = Math.round((((degVal % 360) + 360) % 360) / 22.5) % 16
    return dirs[idx]
  }

  const rotas = []
  const rad = Math.PI / 180.0
  const deg = 180.0 / Math.PI

  for (let i = 0; i < PONTOS_CANONICOS.length; i++) {
    const pTarget = PONTOS_CANONICOS[i]
    const dLat = (pTarget.lat - lat) * rad
    const dLon = (pTarget.lon - lon) * rad
    const lat1 = lat * rad
    const lat2 = pTarget.lat * rad

    // Haversine
    const aH =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const cVal = 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1 - aH))
    const distKm = 6371 * cVal
    const distNm = distKm * 0.539957

    if (distNm < 0.3) {
      continue
    }

    // Bearing
    const yB = Math.sin(dLon) * Math.cos(lat2)
    const xB = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    let bearingDeg = deg * Math.atan2(yB, xB)
    bearingDeg = ((bearingDeg % 360) + 360) % 360

    rotas.push({
      ponto_slug: pTarget.slug,
      ponto_nome: pTarget.nome,
      lat: pTarget.lat,
      lon: pTarget.lon,
      distancia_nm: Math.round(distNm * 10) / 10,
      rumo_graus: Math.round(bearingDeg),
      direcao_cardinal: getCardinalLabel(bearingDeg),
    })
  }

  // Daily astronomia e temperaturas do Open-Meteo
  const dailyData = weatherData.daily || {}
  const dailySunrise = dailyData.sunrise || []
  const dailySunset = dailyData.sunset || []
  const dailyDaylight = dailyData.daylight_duration || []
  const dailyTempMax = dailyData.temperature_2m_max || []
  const dailyTempMin = dailyData.temperature_2m_min || []
  const dailyPrecipProbMax = dailyData.precipitation_probability_max || []
  const dailyTimes = dailyData.time || []

  const dailyList = []
  for (let i = 0; i < dailyTimes.length; i++) {
    dailyList.push({
      date: dailyTimes[i],
      sunrise: dailySunrise[i] || null,
      sunset: dailySunset[i] || null,
      daylight_duration: dailyDaylight[i] || null,
      temperature_2m_max: dailyTempMax[i] !== undefined ? dailyTempMax[i] : null,
      temperature_2m_min: dailyTempMin[i] !== undefined ? dailyTempMin[i] : null,
      precipitation_probability_max:
        dailyPrecipProbMax[i] !== undefined ? dailyPrecipProbMax[i] : null,
    })
  }

  const todayDaily = dailyList[0] || {
    sunrise: dailySunrise[0] || null,
    sunset: dailySunset[0] || null,
    daylight_duration: dailyDaylight[0] || null,
  }

  const resultPayload = {
    ponto_id: pontoId,
    ponto_nome: pontoNome,
    ponto_tipo: pontoTipo,
    lat: lat,
    lon: lon,
    timezone: weatherData.timezone || 'America/Sao_Paulo',
    weather_code:
      currentItem.weather_code !== undefined && currentItem.weather_code !== null
        ? currentItem.weather_code
        : null,
    hourly: mergedHourly,
    daily: dailyList,
    astronomia: {
      nascer_do_sol: todayDaily.sunrise,
      por_do_sol: todayDaily.sunset,
      duracao_luz_segundos: todayDaily.daylight_duration,
      crepusculo_nautico_matutino: twilight.crepusculo_nautico_matutino,
      crepusculo_nautico_vespertino: twilight.crepusculo_nautico_vespertino,
      lua: moonData,
    },
    pressao_tendencia: pressaoTendencia,
    mar_atual: {
      temperatura_agua: currentItem.sea_surface_temperature,
      swell_direcao: currentItem.swell_wave_direction,
      swell_periodo: currentItem.swell_wave_period,
      swell_wave_height_bruto: currentItem.swell_wave_height_bruto,
      swell_wave_height: currentItem.swell_wave_height,
      wave_height_bruto: currentItem.wave_height_bruto,
      wave_height: currentItem.wave_height,
      wave_ajustado: isWaveAjustado,
      fator_abrigo: fatorAbrigo,
      onda_vento_altura: currentItem.wind_wave_height,
      corrente_velocidade: currentItem.ocean_current_velocity,
      corrente_direcao: currentItem.ocean_current_direction,
      douglas_grau: currentDouglas.grau,
      douglas_descricao: currentDouglas.descricao,
      beaufort: currentBeaufort,
    },
    rotas: rotas,
  }

  // 4. Salva no cache_previsao via UPSERT
  const nowIso = new Date().toISOString().replace('T', ' ')
  try {
    const existing = $app.findFirstRecordByData('cache_previsao', 'ponto_id', pontoId)
    existing.set('payload', resultPayload)
    existing.set('obtido_em', nowIso)
    $app.save(existing)
  } catch (findErr) {
    try {
      const cacheCol = $app.findCollectionByNameOrId('cache_previsao')
      const cacheRecord = new Record(cacheCol)
      cacheRecord.set('ponto_id', pontoId)
      cacheRecord.set('payload', resultPayload)
      cacheRecord.set('obtido_em', nowIso)
      $app.save(cacheRecord)
    } catch (saveErr) {
      console.log(
        'Erro ao salvar cache_previsao:',
        saveErr && saveErr.message ? saveErr.message : String(saveErr),
      )
    }
  }

  return e.json(200, resultPayload)
})
