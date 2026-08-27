// Hook travessia.js
// Obs: No PocketBase JSVM, cada callback roda em escopo isolado.
// Toda a lógica e estruturas globais como globalThis devem ser acessadas/declaradas inline.

routerAdd('GET', '/backend/v1/travessia', (e) => {
  const query = e.requestInfo().query || {}
  const origemParam = query['origem']
  const destinoParam = query['destino']
  const horaSaidaParam = query['hora_saida']
  const velocidadeParam = query['velocidade_nos']
  const perfilIdParam = query['perfil_id']
  const consumoLhParam = query['consumo_lh']

  if (!origemParam || !destinoParam) {
    return e.json(400, { error: "Parâmetros 'origem' e 'destino' são obrigatórios" })
  }

  // 1. Resolver Perfil de Navegação (para limites de score e velocidade padrão)
  let perfilRecord = null
  const perfilBusca = perfilIdParam || 'lancha'
  try {
    perfilRecord = $app.findRecordById('perfis_navegacao', perfilBusca)
  } catch (err) {
    try {
      perfilRecord = $app.findFirstRecordByData('perfis_navegacao', 'nome', perfilBusca)
    } catch (err2) {
      try {
        perfilRecord = $app.findFirstRecordByData('perfis_navegacao', 'nome', 'lancha')
      } catch (err3) {
        // Fallback perfil
      }
    }
  }

  const perfilNome = perfilRecord ? perfilRecord.get('nome') : perfilBusca
  const perfilVentoMax = perfilRecord ? Number(perfilRecord.get('vento_max_kt')) || 15 : 15
  const perfilRajadaMax = perfilRecord ? Number(perfilRecord.get('rajada_max_kt')) || 22 : 22
  const perfilOndaMax = perfilRecord ? Number(perfilRecord.get('onda_max_m')) || 1.0 : 1.0
  const rawPeriodoMin = perfilRecord ? perfilRecord.get('periodo_min_s') : null
  const perfilPeriodoMin =
    rawPeriodoMin !== null && rawPeriodoMin !== undefined && Number(rawPeriodoMin) > 0
      ? Number(rawPeriodoMin)
      : null
  const perfilChuvaMax = perfilRecord ? Number(perfilRecord.get('chuva_max_mm_h')) || 4.0 : 4.0

  // Velocidade padrão se não informada
  let velocidadeNos = parseFloat(velocidadeParam)
  if (isNaN(velocidadeNos) || velocidadeNos <= 0) {
    const pNome = perfilNome.toLowerCase()
    if (pNome === 'veleiro') {
      velocidadeNos = 6
    } else if (pNome === 'jet' || pNome === 'jetski' || pNome === 'jet-ski') {
      velocidadeNos = 25
    } else {
      velocidadeNos = 18 // lancha
    }
  }

  // Helper para resolver um ponto (slug ou custom:lat:lon ou lat,lon)
  const PONTOS_FIXOS_LIST = [
    { slug: 'angra', nome: 'Angra dos Reis', lat: -23.0067, lon: -44.318, tipo: 'abrigado' },
    { slug: 'abraao', nome: 'Abraão (Ilha Grande)', lat: -23.1415, lon: -44.1676, tipo: 'semi' },
    { slug: 'paraty', nome: 'Paraty', lat: -23.2178, lon: -44.7131, tipo: 'abrigado' },
    { slug: 'juatinga', nome: 'Juatinga', lat: -23.2833, lon: -44.5833, tipo: 'aberto' },
  ]

  const resolvePonto = (param, defaultNome) => {
    const pStr = (param || '').trim()
    if (pStr.startsWith('custom:')) {
      const parts = pStr.split(':')
      if (parts.length >= 3) {
        const pLat = parseFloat(parts[1])
        const pLon = parseFloat(parts[2])
        const pTipo = parts[3] ? parts[3].toLowerCase() : 'abrigado'
        if (!isNaN(pLat) && !isNaN(pLon)) {
          return {
            slug: 'custom:' + pLat.toFixed(3) + ':' + pLon.toFixed(3),
            nome: defaultNome || 'Ponto Personalizado',
            lat: pLat,
            lon: pLon,
            tipo: pTipo === 'semi' || pTipo === 'aberto' ? pTipo : 'abrigado',
          }
        }
      }
    }

    // Busca nos pontos fixos conhecidos
    const low = pStr.toLowerCase()
    for (let i = 0; i < PONTOS_FIXOS_LIST.length; i++) {
      if (
        PONTOS_FIXOS_LIST[i].slug === low ||
        PONTOS_FIXOS_LIST[i].nome.toLowerCase() === low ||
        (low === 'abraão' && PONTOS_FIXOS_LIST[i].slug === 'abraao')
      ) {
        return PONTOS_FIXOS_LIST[i]
      }
    }

    // Busca no banco PocketBase
    try {
      const rec = $app.findRecordById('pontos', pStr)
      return {
        slug: rec.get('slug') || rec.id,
        nome: rec.get('nome'),
        lat: Number(rec.get('lat')),
        lon: Number(rec.get('lon')),
        tipo: rec.get('tipo') || 'abrigado',
      }
    } catch (_) {
      try {
        const rec = $app.findFirstRecordByData('pontos', 'slug', pStr)
        return {
          slug: rec.get('slug') || rec.id,
          nome: rec.get('nome'),
          lat: Number(rec.get('lat')),
          lon: Number(rec.get('lon')),
          tipo: rec.get('tipo') || 'abrigado',
        }
      } catch (_2) {
        try {
          const rec = $app.findFirstRecordByData('pontos', 'nome', pStr)
          return {
            slug: rec.get('slug') || rec.id,
            nome: rec.get('nome'),
            lat: Number(rec.get('lat')),
            lon: Number(rec.get('lon')),
            tipo: rec.get('tipo') || 'abrigado',
          }
        } catch (_3) {}
      }
    }

    // Tenta formato lat,lon
    if (pStr.includes(',')) {
      const parts = pStr.split(',')
      const pLat = parseFloat(parts[0])
      const pLon = parseFloat(parts[1])
      if (!isNaN(pLat) && !isNaN(pLon)) {
        return {
          slug: 'custom:' + pLat.toFixed(3) + ':' + pLon.toFixed(3),
          nome: defaultNome || 'Ponto Personalizado',
          lat: pLat,
          lon: pLon,
          tipo: 'abrigado',
        }
      }
    }

    return null
  }

  const pontoOrigem = resolvePonto(origemParam, 'Origem')
  const pontoDestino = resolvePonto(destinoParam, 'Destino')

  if (!pontoOrigem || !pontoDestino) {
    return e.json(400, {
      error: 'Origem ou destino inválidos: ' + (!pontoOrigem ? origemParam : destinoParam),
    })
  }

  // 2. Cálculo da Distância (Haversine) e Rumo Verdadeiro
  const rad = Math.PI / 180.0
  const deg = 180.0 / Math.PI

  const dLat = (pontoDestino.lat - pontoOrigem.lat) * rad
  const dLon = (pontoDestino.lon - pontoOrigem.lon) * rad
  const lat1Rad = pontoOrigem.lat * rad
  const lat2Rad = pontoDestino.lat * rad

  const aH =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const cVal = 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1 - aH))
  const distKm = 6371 * cVal
  const distNm = Math.round(distKm * 0.539957 * 10) / 10

  const yB = Math.sin(dLon) * Math.cos(lat2Rad)
  const xB =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)
  let rumoVerdadeiro = deg * Math.atan2(yB, xB)
  rumoVerdadeiro = Math.round(((rumoVerdadeiro % 360) + 360) % 360)

  // Helpers de Fuso Horário (America/Sao_Paulo: offset padrão UTC-3)
  const SAO_PAULO_OFFSET_MINUTES = -180 // -03:00

  // Converte timestamp em milissegundos para string ISO com offset America/Sao_Paulo (-03:00)
  // Ex: 1787832000000 -> "2026-08-27T08:00:00-03:00"
  const formatIsoSaoPaulo = (ms) => {
    const d = new Date(ms + SAO_PAULO_OFFSET_MINUTES * 60 * 1000)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const y = d.getUTCFullYear()
    const m = pad(d.getUTCMonth() + 1)
    const day = pad(d.getUTCDate())
    const h = pad(d.getUTCHours())
    const min = pad(d.getUTCMinutes())
    const s = pad(d.getUTCSeconds())
    return y + '-' + m + '-' + day + 'T' + h + ':' + min + ':' + s + '-03:00'
  }

  // Parser robusto para hora de saída recebida
  // Se vier no formato YYYY-MM-DDTHH:MM sem offset, interpreta explicitamente como America/Sao_Paulo (-03:00)
  const parseDateSaoPaulo = (str) => {
    if (!str) return Date.now()
    let s = String(str).trim()
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      s += '-03:00'
    }
    const t = new Date(s).getTime()
    return isNaN(t) ? Date.now() : t
  }

  // 3. Duração e ETA
  const duracaoHoras = distNm > 0 && velocidadeNos > 0 ? distNm / velocidadeNos : 0
  const duracaoHorasArredondada = Math.round(duracaoHoras * 10) / 10

  const horaSaidaMs = parseDateSaoPaulo(horaSaidaParam)
  const duracaoMs = duracaoHoras * 3600 * 1000
  const meioMs = horaSaidaMs + duracaoMs / 2
  const etaMs = horaSaidaMs + duracaoMs

  const horaSaidaIso = formatIsoSaoPaulo(horaSaidaMs)
  const meioIso = formatIsoSaoPaulo(meioMs)
  const etaIso = formatIsoSaoPaulo(etaMs)

  // 4. Ponto Médio
  const meioLat = (pontoOrigem.lat + pontoDestino.lat) / 2
  const meioLon = (pontoOrigem.lon + pontoDestino.lon) / 2
  const pontoMeio = {
    slug: 'custom:' + meioLat.toFixed(3) + ':' + meioLon.toFixed(3),
    nome: 'Ponto Médio',
    lat: meioLat,
    lon: meioLon,
    tipo: 'semi',
  }

  // Helper para obter dados de previsão com Cache UPSERT 30min
  const getPrevisaoData = (pt) => {
    const cachePontoKey = pt.slug.startsWith('custom:')
      ? pt.slug
      : pt.slug || 'custom:' + pt.lat.toFixed(3) + ':' + pt.lon.toFixed(3)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().replace('T', ' ')

    try {
      const cachedRecords = $app.findRecordsByFilter(
        'cache_previsao',
        "ponto_id = '" + cachePontoKey + "' && obtido_em >= '" + thirtyMinutesAgo + "'",
        '-obtido_em',
        1,
        0,
      )
      if (cachedRecords && cachedRecords.length > 0) {
        const payload = cachedRecords[0].get('payload')
        if (payload && payload.hourly) {
          return payload
        }
      }
    } catch (_) {}

    // Busca Open-Meteo
    const weatherUrl =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(pt.lat) +
      '&longitude=' +
      encodeURIComponent(pt.lon) +
      '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility,temperature_2m,surface_pressure,cloud_cover,uv_index' +
      '&daily=sunrise,sunset,daylight_duration' +
      '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=7'

    const marineUrl =
      'https://marine-api.open-meteo.com/v1/marine?latitude=' +
      encodeURIComponent(pt.lat) +
      '&longitude=' +
      encodeURIComponent(pt.lon) +
      '&hourly=wave_height,wave_period,sea_level_height_msl,sea_surface_temperature,swell_wave_direction,swell_wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction' +
      '&timezone=America%2FSao_Paulo&forecast_days=7'

    let wRes
    let mRes
    try {
      wRes = $http.send({ url: weatherUrl, method: 'GET', timeout: 15 })
    } catch (err) {
      return null
    }
    if (!wRes || wRes.statusCode !== 200) return null

    try {
      mRes = $http.send({ url: marineUrl, method: 'GET', timeout: 15 })
    } catch (err) {
      return null
    }

    if (!mRes || mRes.statusCode === 400 || mRes.statusCode === 404 || mRes.statusCode === 422) {
      return { _terraError: true }
    }
    if (mRes.statusCode !== 200) return null

    const wData = wRes.json
    const mData = mRes.json
    if (!wData || !wData.hourly || !wData.hourly.time) return null

    const mTimes = mData && mData.hourly ? mData.hourly.time || [] : []
    const mWaveHeight = mData && mData.hourly ? mData.hourly.wave_height || [] : []
    const mWavePeriod = mData && mData.hourly ? mData.hourly.wave_period || [] : []
    const marineMap = {}
    for (let i = 0; i < mTimes.length; i++) {
      marineMap[mTimes[i]] = {
        wave_height: mWaveHeight[i] !== undefined ? mWaveHeight[i] : null,
        wave_period: mWavePeriod[i] !== undefined ? mWavePeriod[i] : null,
      }
    }

    const wTimes = wData.hourly.time
    const wWindSpeed = wData.hourly.wind_speed_10m || []
    const wWindDir = wData.hourly.wind_direction_10m || []
    const wWindGusts = wData.hourly.wind_gusts_10m || []
    const wPrecipitation = wData.hourly.precipitation || []

    const merged = []
    for (let i = 0; i < wTimes.length; i++) {
      const t = wTimes[i]
      const mItem = marineMap[t] || { wave_height: null, wave_period: null }
      merged.push({
        time: t,
        wind_speed_10m: wWindSpeed[i] !== undefined ? wWindSpeed[i] : null,
        wind_direction_10m: wWindDir[i] !== undefined ? wWindDir[i] : null,
        wind_gusts_10m: wWindGusts[i] !== undefined ? wWindGusts[i] : null,
        precipitation: wPrecipitation[i] !== undefined ? wPrecipitation[i] : null,
        wave_height: mItem.wave_height,
        wave_period: mItem.wave_period,
      })
    }

    const dailyTimes = (wData.daily && wData.daily.time) || []
    const dailySunset = (wData.daily && wData.daily.sunset) || []
    const dailySunrise = (wData.daily && wData.daily.sunrise) || []
    const dailyList = []
    for (let i = 0; i < dailyTimes.length; i++) {
      dailyList.push({
        date: dailyTimes[i],
        sunset: dailySunset[i] || null,
        sunrise: dailySunrise[i] || null,
      })
    }

    const payloadResult = {
      ponto_id: cachePontoKey,
      hourly: merged,
      daily: dailyList,
    }

    // Salva no cache
    const nowIso = new Date().toISOString().replace('T', ' ')
    try {
      const existing = $app.findFirstRecordByData('cache_previsao', 'ponto_id', cachePontoKey)
      existing.set('payload', payloadResult)
      existing.set('obtido_em', nowIso)
      $app.save(existing)
    } catch (_) {
      try {
        const cacheCol = $app.findCollectionByNameOrId('cache_previsao')
        const cacheRecord = new Record(cacheCol)
        cacheRecord.set('ponto_id', cachePontoKey)
        cacheRecord.set('payload', payloadResult)
        cacheRecord.set('obtido_em', nowIso)
        $app.save(cacheRecord)
      } catch (_saveErr) {}
    }

    return payloadResult
  }

  const prevOrigem = getPrevisaoData(pontoOrigem)
  const prevMeio = getPrevisaoData(pontoMeio)
  const prevDestino = getPrevisaoData(pontoDestino)

  if (prevOrigem?._terraError || prevMeio?._terraError || prevDestino?._terraError) {
    return e.json(400, {
      error: 'esta posição parece estar em terra — ajuste para o mar',
    })
  }

  if (!prevOrigem || !prevMeio || !prevDestino) {
    return e.json(502, {
      error: 'Não foi possível obter dados meteorológicos para os pontos da travessia',
    })
  }

  // Helper para buscar a hora mais próxima em uma lista horária (Open-Meteo retorna 'YYYY-MM-DDTHH:00' na timezone America/Sao_Paulo)
  const findHourlyAt = (hourlyList, targetIso) => {
    if (!hourlyList || hourlyList.length === 0) return null
    const targetMs = parseDateSaoPaulo(targetIso)
    let closest = hourlyList[0]
    let minDiff = Infinity
    for (let i = 0; i < hourlyList.length; i++) {
      const itemMs = parseDateSaoPaulo(hourlyList[i].time)
      const diff = Math.abs(itemMs - targetMs)
      if (diff < minDiff) {
        minDiff = diff
        closest = hourlyList[i]
      }
    }
    return closest
  }

  // Helper para calcular a direção relativa do vento em relação ao rumo (0 a 180 de diferença angular)
  // "proa" se vento vindo de ±45° do rumo, "través" se ±45°–±135°, "popa" se > ±135°
  const getDirecaoRelativa = (direcaoVentoDeg, rumoDeg) => {
    if (direcaoVentoDeg === null || direcaoVentoDeg === undefined || isNaN(direcaoVentoDeg)) {
      return 'través'
    }
    let diff = Math.abs(direcaoVentoDeg - rumoDeg) % 360
    if (diff > 180) diff = 360 - diff

    if (diff <= 45) {
      return 'proa'
    } else if (diff <= 135) {
      return 'través'
    } else {
      return 'popa'
    }
  }

  // Helper para calcular o score náutico (seguindo janelas.js)
  const calcularScoreItem = (item, pontoTipo) => {
    if (!item) return { score: 50, fatorLimitante: null }
    const windSpeed = item.wind_speed_10m !== null ? item.wind_speed_10m : 0
    const windGusts = item.wind_gusts_10m !== null ? item.wind_gusts_10m : 0
    const waveHeight = item.wave_height !== null ? item.wave_height : 0
    const wavePeriod = item.wave_period !== null ? item.wave_period : null
    const precipitation = item.precipitation !== null ? item.precipitation : 0

    let exposicaoDeducao = 0
    if (pontoTipo === 'semi') exposicaoDeducao = 10
    else if (pontoTipo === 'aberto') exposicaoDeducao = 20

    let penalidadeVento = 0
    let penalidadeRajada = 0
    let penalidadeOnda = 0
    let penalidadePeriodo = 0
    let penalidadeChuva = 0

    if (windSpeed > perfilVentoMax) {
      penalidadeVento = Math.round(
        Math.min(50, ((windSpeed - perfilVentoMax) / perfilVentoMax) * 50),
      )
    }
    if (windGusts > perfilRajadaMax) {
      penalidadeRajada = Math.round(
        Math.min(40, ((windGusts - perfilRajadaMax) / perfilRajadaMax) * 40),
      )
    }
    if (waveHeight > perfilOndaMax) {
      penalidadeOnda = Math.round(
        Math.min(50, ((waveHeight - perfilOndaMax) / (perfilOndaMax * 2)) * 50),
      )
    }
    if (
      perfilPeriodoMin !== null &&
      wavePeriod !== null &&
      wavePeriod > 0 &&
      wavePeriod < perfilPeriodoMin
    ) {
      penalidadePeriodo = Math.round(
        Math.min(30, ((perfilPeriodoMin - wavePeriod) / perfilPeriodoMin) * 30),
      )
    }
    if (precipitation > perfilChuvaMax) {
      penalidadeChuva = Math.round(
        Math.min(30, ((precipitation - perfilChuvaMax) / perfilChuvaMax) * 30),
      )
    }

    let score =
      100 -
      penalidadeVento -
      penalidadeRajada -
      penalidadeOnda -
      penalidadePeriodo -
      penalidadeChuva -
      exposicaoDeducao
    if (score < 0) score = 0
    if (score > 100) score = 100

    let fatorLimitante = null
    if (score < 90) {
      const pens = [
        { tipo: 'vento ' + Math.round(windSpeed) + ' kt', val: penalidadeVento },
        { tipo: 'rajada ' + Math.round(windGusts) + ' kt', val: penalidadeRajada },
        { tipo: 'onda ' + waveHeight.toFixed(1) + ' m', val: penalidadeOnda },
        {
          tipo: 'período ' + (wavePeriod ? wavePeriod.toFixed(1) : '0') + ' s',
          val: penalidadePeriodo,
        },
        { tipo: 'chuva ' + precipitation.toFixed(1) + ' mm/h', val: penalidadeChuva },
      ]
      let maxP = 0
      for (let i = 0; i < pens.length; i++) {
        if (pens[i].val > maxP) {
          maxP = pens[i].val
          fatorLimitante = pens[i].tipo
        }
      }
      if (!fatorLimitante && exposicaoDeducao > 0) {
        fatorLimitante = 'exposição ' + pontoTipo
      }
    }

    return { score, fatorLimitante }
  }

  // 5. Montar as 3 amostras
  const hOrigem = findHourlyAt(prevOrigem.hourly, horaSaidaIso)
  const hMeio = findHourlyAt(prevMeio.hourly, meioIso)
  const hDestino = findHourlyAt(prevDestino.hourly, etaIso)

  const calcAmostra = (tipo, pontoInfo, horarioIso, hData) => {
    const windSpeed = hData?.wind_speed_10m !== null ? Math.round(hData?.wind_speed_10m || 0) : 0
    const windGusts = hData?.wind_gusts_10m !== null ? Math.round(hData?.wind_gusts_10m || 0) : 0
    const windDir =
      hData?.wind_direction_10m !== null ? Math.round(hData?.wind_direction_10m || 0) : 0
    const waveH =
      hData?.wave_height !== null && hData?.wave_height !== undefined
        ? Math.round(hData.wave_height * 10) / 10
        : 0.0
    const waveP =
      hData?.wave_period !== null && hData?.wave_period !== undefined
        ? Math.round(hData.wave_period)
        : 0
    const rainMm =
      hData?.precipitation !== null && hData?.precipitation !== undefined
        ? Math.round(hData.precipitation * 10) / 10
        : 0.0

    const dirRel = getDirecaoRelativa(windDir, rumoVerdadeiro)
    const { score, fatorLimitante } = calcularScoreItem(hData, pontoInfo.tipo)

    // Rebaixamento individual:
    // - Vento de proa > 15 kt
    // - Onda de través > 1,0 m
    let rebaixada = false
    let motivoRebaixamento = null

    if (dirRel === 'proa' && windSpeed > 15) {
      rebaixada = true
      motivoRebaixamento = 'Vento de proa forte (' + windSpeed + ' kt)'
    }
    if (dirRel === 'través' && waveH > 1.0) {
      rebaixada = true
      motivoRebaixamento =
        (motivoRebaixamento ? motivoRebaixamento + ' + ' : '') +
        'Onda de través (' +
        waveH.toFixed(1) +
        ' m)'
    }

    return {
      tipo: tipo,
      ponto_nome: pontoInfo.nome,
      horario: horarioIso,
      vento_nos: windSpeed,
      rajada_nos: windGusts,
      direcao_vento: windDir,
      direcao_relativa: dirRel,
      altura_onda_m: waveH,
      periodo_onda_s: waveP,
      score: score,
      chuva_mmh: rainMm,
      rebaixada: rebaixada,
      motivo_rebaixamento: motivoRebaixamento,
      fator_limitante: fatorLimitante,
    }
  }

  const amostra1 = calcAmostra('origem', pontoOrigem, horaSaidaIso, hOrigem)
  const amostra2 = calcAmostra('meio', pontoMeio, meioIso, hMeio)
  const amostra3 = calcAmostra('destino', pontoDestino, etaIso, hDestino)

  const amostras = [amostra1, amostra2, amostra3]

  // 6. Verificar pôr do sol e crepúsculo no destino
  const etaDateStr = etaIso.slice(0, 10)
  let sunsetDestino = null

  const dList = prevDestino.daily || []
  for (let i = 0; i < dList.length; i++) {
    if (dList[i].date === etaDateStr) {
      sunsetDestino = dList[i].sunset
      break
    }
  }
  if (!sunsetDestino && dList.length > 0) {
    sunsetDestino = dList[0].sunset
  }

  let chegadaNoturna = false
  if (sunsetDestino) {
    const sunsetMs = parseDateSaoPaulo(sunsetDestino)
    if (etaMs > sunsetMs) {
      chegadaNoturna = true
    }
  }

  // Hora limite de saída para que ETA <= sunset do dia da saída/destino
  let horaLimiteSaidaIso = null
  if (sunsetDestino) {
    const sunsetMs = parseDateSaoPaulo(sunsetDestino)
    const maxSaidaMs = sunsetMs - duracaoMs
    horaLimiteSaidaIso = formatIsoSaoPaulo(maxSaidaMs)
  }

  // Função unificada para consolidar alertas por tipo (ex: onda_traves, vento_proa, chegada_noturna, etc.)
  const consolidarAlertas = (amostrasList, isNoite) => {
    const rawAlertas = []

    amostrasList.forEach((am) => {
      const trechoNome = am.tipo === 'origem' ? 'início' : am.tipo === 'meio' ? 'meio' : 'final'

      if (am.direcao_relativa === 'proa' && am.vento_nos > 15) {
        rawAlertas.push({
          tipo: 'vento_proa',
          tipoDesc: 'Vento de proa',
          trecho: trechoNome,
          valor: am.vento_nos,
          unidade: 'kt',
        })
      }
      if (am.direcao_relativa === 'través' && am.altura_onda_m > 1.0) {
        rawAlertas.push({
          tipo: 'onda_traves',
          tipoDesc: 'Onda de través',
          trecho: trechoNome,
          valor: am.altura_onda_m,
          unidade: 'm',
        })
      }
    })

    if (isNoite) {
      rawAlertas.push({
        tipo: 'chegada_noturna',
        tipoDesc: 'Chegada noturna',
        trecho: 'final',
        valor: null,
        unidade: '',
      })
    }

    // Agrupamento por tipo de alerta
    const agrupados = {}
    rawAlertas.forEach((al) => {
      if (!agrupados[al.tipo]) {
        agrupados[al.tipo] = {
          tipo: al.tipo,
          tipoDesc: al.tipoDesc,
          unidade: al.unidade,
          maxValor: al.valor,
          trechos: [al.trecho],
          trechoMax: al.trecho,
        }
      } else {
        const ag = agrupados[al.tipo]
        if (!ag.trechos.includes(al.trecho)) {
          ag.trechos.push(al.trecho)
        }
        if (al.valor !== null && (ag.maxValor === null || al.valor > ag.maxValor)) {
          ag.maxValor = al.valor
          ag.trechoMax = al.trecho
        }
      }
    })

    // Monta mensagens consolidadas legíveis e array de alertas estruturados
    const mensagensConsolidadas = []
    const alertasConsolidados = []

    Object.keys(agrupados).forEach((key) => {
      const ag = agrupados[key]
      alertasConsolidados.push(ag)

      if (ag.tipo === 'chegada_noturna') {
        mensagensConsolidadas.push('Chegada noturna (após o pôr do sol no destino)')
      } else {
        const valStr =
          ag.unidade === 'm'
            ? ag.maxValor.toFixed(1).replace('.', ',') + ' m'
            : Math.round(ag.maxValor) + ' ' + ag.unidade

        if (ag.trechos.length === 1) {
          mensagensConsolidadas.push(ag.tipoDesc + ' até ' + valStr + ' no trecho ' + ag.trechos[0])
        } else {
          mensagensConsolidadas.push(
            ag.tipoDesc + ' até ' + valStr + ' nos trechos ' + ag.trechos.join(', '),
          )
        }
      }
    })

    return {
      raw: rawAlertas,
      consolidados: alertasConsolidados,
      mensagens: mensagensConsolidadas,
    }
  }

  // Função única para calcular veredito completo
  const calcularVereditoCompleto = (amostrasList, isNoite) => {
    const scs = [amostrasList[0].score, amostrasList[1].score, amostrasList[2].score]
    const mScore = Math.min(...scs)
    const temReb =
      amostrasList[0].rebaixada || amostrasList[1].rebaixada || amostrasList[2].rebaixada

    let v = 'verde'
    let vCor = '#22c55e'

    if (mScore < 50) {
      v = 'vermelho'
      vCor = '#ef4444'
    } else if (mScore < 70 || temReb || isNoite) {
      v = 'amarelo'
      vCor = '#eab308'
    } else {
      v = 'verde'
      vCor = '#22c55e'
    }

    const alertasInfo = consolidarAlertas(amostrasList, isNoite)

    let avisoMsg = null
    if (alertasInfo.mensagens.length > 0) {
      avisoMsg = alertasInfo.mensagens.join('; ')
    } else if (isNoite) {
      avisoMsg = 'chegada noturna'
    }

    // Fator limitante mais expressivo
    const allLimiters = [
      amostrasList[0].fator_limitante,
      amostrasList[1].fator_limitante,
      amostrasList[2].fator_limitante,
    ].filter(Boolean)
    const fatorLim =
      allLimiters[0] ||
      (isNoite ? 'chegada noturna' : temReb ? 'rebaixamento de mar/vento' : 'nenhum')

    return {
      veredito: v,
      vereditoCor: vCor,
      minScore: mScore,
      temRebaixamento: temReb,
      chegadaNoturna: isNoite,
      aviso: avisoMsg,
      alertas: alertasInfo.raw,
      alertas_consolidados: alertasInfo.consolidados,
      fatorLimitante: fatorLim,
    }
  }

  // 7. Veredito Final da Travessia Principal
  const vereditoPrincipal = calcularVereditoCompleto(amostras, chegadaNoturna)
  const veredito = vereditoPrincipal.veredito
  const vereditoCor = vereditoPrincipal.vereditoCor
  const aviso = vereditoPrincipal.aviso
  const alertas = vereditoPrincipal.alertas
  const alertasConsolidados = vereditoPrincipal.alertas_consolidados

  // 8. Combustível
  let combustivelLitros = null
  let combustivelComReserva = null
  const consumoLh = parseFloat(consumoLhParam)
  if (!isNaN(consumoLh) && consumoLh > 0) {
    combustivelLitros = Math.round(duracaoHoras * consumoLh * 10) / 10
    combustivelComReserva = Math.round(combustivelLitros * 1.2 * 10) / 10
  }

  // 9. Varredura de Alternativas
  // Regras:
  // (a) Usar a MESMA função de veredito completo (calcularVereditoCompleto)
  // (b) Excluir a hora de saída original da varredura (hStep = 1..24 garante offset > 0)
  // (c) Só sugerir alternativa se for ESTRITAMENTE MELHOR que a travessia original:
  //     Qualidade: verde > amarelo > vermelho.
  //     Em empate de cor, comparar pelo score mínimo entre as 3 amostras (maior score mínimo vence).
  //     Se nenhum candidato for estritamente melhor, melhorAlternativa = null.

  const rankVeredito = (ver) => {
    if (ver === 'verde') return 3
    if (ver === 'amarelo') return 2
    return 1 // vermelho
  }

  const principalRank = rankVeredito(veredito)
  const principalMinScore = vereditoPrincipal.minScore

  // Função comparadora: retorna true se candidate for estritamente melhor que target
  const isEstritamenteMelhor = (candRank, candMinScore, baseRank, baseMinScore) => {
    if (candRank > baseRank) return true
    if (candRank === baseRank && candMinScore > baseMinScore) return true
    return false
  }

  let melhorAlternativa = null
  let bestCandidate = null
  let bestRank = principalRank
  let bestMinScore = principalMinScore

  // Varre saídas de hora em hora nas próximas 24h (hStep = 1 a 24, excluindo a hora original hStep=0)
  for (let hStep = 1; hStep <= 24; hStep++) {
    const candSaidaMs = horaSaidaMs + hStep * 3600 * 1000
    const candMeioMs = candSaidaMs + duracaoMs / 2
    const candEtaMs = candSaidaMs + duracaoMs

    const candSaidaIso = formatIsoSaoPaulo(candSaidaMs)
    const candMeioIso = formatIsoSaoPaulo(candMeioMs)
    const candEtaIso = formatIsoSaoPaulo(candEtaMs)

    const candHOrigem = findHourlyAt(prevOrigem.hourly, candSaidaIso)
    const candHMeio = findHourlyAt(prevMeio.hourly, candMeioIso)
    const candHDestino = findHourlyAt(prevDestino.hourly, candEtaIso)

    const a1 = calcAmostra('origem', pontoOrigem, candSaidaIso, candHOrigem)
    const a2 = calcAmostra('meio', pontoMeio, candMeioIso, candHMeio)
    const a3 = calcAmostra('destino', pontoDestino, candEtaIso, candHDestino)
    const candAmostras = [a1, a2, a3]

    // Checa pôr do sol para a candidata
    const candEtaDate = candEtaIso.slice(0, 10)
    let candSunset = null
    for (let k = 0; k < dList.length; k++) {
      if (dList[k].date === candEtaDate) {
        candSunset = dList[k].sunset
        break
      }
    }
    const candNoite = candSunset ? candEtaMs > parseDateSaoPaulo(candSunset) : false

    // Calcula veredito completo do candidato com as MESMAS regras da travessia principal
    const candVereditoObj = calcularVereditoCompleto(candAmostras, candNoite)
    const candRankVal = rankVeredito(candVereditoObj.veredito)
    const candMinScoreVal = candVereditoObj.minScore

    if (isEstritamenteMelhor(candRankVal, candMinScoreVal, bestRank, bestMinScore)) {
      bestRank = candRankVal
      bestMinScore = candMinScoreVal
      bestCandidate = {
        hora_saida: candSaidaIso,
        eta: candEtaIso,
        veredito: candVereditoObj.veredito,
        veredito_cor: candVereditoObj.vereditoCor,
        score_minimo: candMinScoreVal,
        fator_limitante: candVereditoObj.fatorLimitante,
        aviso: candVereditoObj.aviso,
        alertas: candVereditoObj.alertas,
        alertas_consolidados: candVereditoObj.alertas_consolidados,
      }
    }
  }

  // Se encontramos algum candidato estritamente melhor que a travessia original
  if (
    bestCandidate &&
    isEstritamenteMelhor(
      rankVeredito(bestCandidate.veredito),
      bestCandidate.score_minimo,
      principalRank,
      principalMinScore,
    )
  ) {
    melhorAlternativa = bestCandidate
  }

  const responsePayload = {
    origem: {
      slug: pontoOrigem.slug,
      nome: pontoOrigem.nome,
      lat: pontoOrigem.lat,
      lon: pontoOrigem.lon,
      tipo: pontoOrigem.tipo,
    },
    destino: {
      slug: pontoDestino.slug,
      nome: pontoDestino.nome,
      lat: pontoDestino.lat,
      lon: pontoDestino.lon,
      tipo: pontoDestino.tipo,
    },
    distancia_nm: distNm,
    rumo_verdadeiro: rumoVerdadeiro,
    duracao_horas: duracaoHorasArredondada,
    hora_saida: horaSaidaIso,
    eta: etaIso,
    velocidade_nos: velocidadeNos,
    veredito: veredito,
    veredito_cor: vereditoCor,
    aviso: aviso,
    alertas: alertas,
    alertas_consolidados: alertasConsolidados,
    amostras: amostras,
    combustivel_litros: combustivelLitros,
    combustivel_com_reserva: combustivelComReserva,
    melhor_alternativa: melhorAlternativa,
    hora_limite_saida: horaLimiteSaidaIso,
  }

  return e.json(200, responsePayload)
})
