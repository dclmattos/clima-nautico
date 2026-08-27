// Endpoint GET /backend/v1/resumo-dia?perfil_id=&dispositivo_uuid=&pontos_personalizados=
// Para cada ponto (fixos + personalizados), calcula score hora a hora do período diurno
// Melhor ponto: maior score médio diurno + horário da janela
// Ponto a evitar: menor score + fator limitante
// Alerta frente fria: varre 48h procurando vento S/SW/SSW > 15kt OU queda pressão ≥ 3 hPa em 3h
// Usa cache_previsao existente, não chama Open-Meteo
// Retorna JSON: { melhor: {ponto_nome, slug, score_medio, janela_inicio, janela_fim}, evitar: {ponto_nome, slug, score_medio, fator_limitante}, frente_fria: string, atualizado_em: ISO }

routerAdd('GET', '/backend/v1/resumo-dia', (e) => {
  const query = e.requestInfo().query || {}
  const perfilIdParam = query['perfil_id']
  const pontosPersonalizadosParam = query['pontos_personalizados']

  if (!perfilIdParam) {
    return e.json(400, { erro: "Parâmetro 'perfil_id' é obrigatório" })
  }

  // 1. Carrega o perfil da collection perfis_navegacao
  let perfilRecord = null
  try {
    perfilRecord = $app.findRecordById('perfis_navegacao', perfilIdParam)
  } catch (err) {
    try {
      perfilRecord = $app.findFirstRecordByData('perfis_navegacao', 'nome', perfilIdParam)
    } catch (err2) {
      return e.json(404, { erro: 'Perfil não encontrado: ' + perfilIdParam })
    }
  }

  const perfilVentoMax = Number(perfilRecord.get('vento_max_kt')) || 15
  const perfilRajadaMax = Number(perfilRecord.get('rajada_max_kt')) || 22
  const perfilOndaMax = Number(perfilRecord.get('onda_max_m')) || 1.0
  const rawPeriodoMin = perfilRecord.get('periodo_min_s')
  const perfilPeriodoMin =
    rawPeriodoMin !== null && rawPeriodoMin !== undefined && Number(rawPeriodoMin) > 0
      ? Number(rawPeriodoMin)
      : null
  const perfilChuvaMax = Number(perfilRecord.get('chuva_max_mm_h')) || 4.0

  // 2. Monta lista de pontos a avaliar: 4 fixos + personalizados
  const pontosLista = []

  // Busca pontos fixos do banco
  const PONTOS_FIXOS_DEFAULT = [
    { slug: 'angra', nome: 'Angra dos Reis', tipo: 'abrigado' },
    { slug: 'abraao', nome: 'Abraão', tipo: 'semi' },
    { slug: 'paraty', nome: 'Paraty', tipo: 'abrigado' },
    { slug: 'juatinga', nome: 'Juatinga', tipo: 'aberto' },
  ]

  try {
    const records = $app.findRecordsByFilter('pontos', '', 'created', 10, 0)
    if (records && records.length > 0) {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        pontosLista.push({
          slug: r.get('slug') || r.id,
          nome: r.get('nome'),
          tipo: r.get('tipo') || 'abrigado',
          cacheKey: r.get('slug') || r.id,
        })
      }
    } else {
      for (let i = 0; i < PONTOS_FIXOS_DEFAULT.length; i++) {
        pontosLista.push({
          slug: PONTOS_FIXOS_DEFAULT[i].slug,
          nome: PONTOS_FIXOS_DEFAULT[i].nome,
          tipo: PONTOS_FIXOS_DEFAULT[i].tipo,
          cacheKey: PONTOS_FIXOS_DEFAULT[i].slug,
        })
      }
    }
  } catch (err) {
    for (let i = 0; i < PONTOS_FIXOS_DEFAULT.length; i++) {
      pontosLista.push({
        slug: PONTOS_FIXOS_DEFAULT[i].slug,
        nome: PONTOS_FIXOS_DEFAULT[i].nome,
        tipo: PONTOS_FIXOS_DEFAULT[i].tipo,
        cacheKey: PONTOS_FIXOS_DEFAULT[i].slug,
      })
    }
  }

  // Parse de pontos personalizados enviados pelo frontend
  if (pontosPersonalizadosParam) {
    try {
      const customArray = JSON.parse(pontosPersonalizadosParam)
      if (Array.isArray(customArray)) {
        for (let i = 0; i < customArray.length; i++) {
          const cp = customArray[i]
          const pLat = parseFloat(cp.lat !== undefined ? cp.lat : cp.latitude)
          const pLon = parseFloat(cp.lon !== undefined ? cp.lon : cp.longitude)
          if (!isNaN(pLat) && !isNaN(pLon)) {
            const latStr = pLat.toFixed(3)
            const lonStr = pLon.toFixed(3)
            const cKey = 'custom:' + latStr + ':' + lonStr
            let pTipo = (cp.tipo || '').toLowerCase().trim()
            if (pTipo === 'semi' || pTipo === 'semi-abrigado') pTipo = 'semi'
            else if (pTipo === 'aberto' || pTipo === 'mar aberto' || pTipo === 'mar-aberto')
              pTipo = 'aberto'
            else pTipo = 'abrigado'

            pontosLista.push({
              slug: cKey,
              nome: (cp.nome || 'Ponto Personalizado').trim(),
              tipo: pTipo,
              cacheKey: cKey,
            })
          }
        }
      }
    } catch (errJson) {
      // Ignora erro de parse de pontos personalizados
    }
  }

  // 3. Helper de cálculo de score hora a hora (mesma fórmula de janelas.js)
  const calcularScoreHora = (item, pontoTipo) => {
    if (!item) return { score: 50, fatorLimitanteDesc: null }
    const windSpeed =
      item.wind_speed_10m !== null && item.wind_speed_10m !== undefined ? item.wind_speed_10m : 0
    const windGusts =
      item.wind_gusts_10m !== null && item.wind_gusts_10m !== undefined ? item.wind_gusts_10m : 0
    const waveHeight =
      item.wave_height !== null && item.wave_height !== undefined ? item.wave_height : 0
    const wavePeriod =
      item.wave_period !== null && item.wave_period !== undefined ? item.wave_period : null
    const precipitation =
      item.precipitation !== null && item.precipitation !== undefined ? item.precipitation : 0

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

    let fatorLimitanteDesc = null
    if (score < 90) {
      const penalidades = [
        { tipo: 'vento ' + Math.round(windSpeed) + ' kt', val: penalidadeVento },
        { tipo: 'rajadas ' + Math.round(windGusts) + ' kt', val: penalidadeRajada },
        { tipo: 'ondas ' + waveHeight.toFixed(1) + ' m', val: penalidadeOnda },
        {
          tipo: 'período ' + (wavePeriod ? wavePeriod.toFixed(1) : '0') + ' s',
          val: penalidadePeriodo,
        },
        { tipo: 'chuva ' + precipitation.toFixed(1) + ' mm/h', val: penalidadeChuva },
      ]
      let maxPen = 0
      for (let pIdx = 0; pIdx < penalidades.length; pIdx++) {
        if (penalidades[pIdx].val > maxPen) {
          maxPen = penalidades[pIdx].val
          fatorLimitanteDesc = penalidades[pIdx].tipo
        }
      }
      if (!fatorLimitanteDesc && exposicaoDeducao > 0) {
        fatorLimitanteDesc = 'exposição ' + pontoTipo
      }
    }

    return { score, fatorLimitanteDesc }
  }

  // 4. Busca caches e analisa cada ponto
  const resultadosPontos = []
  const all48hHourly = []

  const nowMs = Date.now()
  const todayDateStr = new Date(nowMs - 3 * 3600 * 1000).toISOString().slice(0, 10) // UTC-3 data

  for (let i = 0; i < pontosLista.length; i++) {
    const pt = pontosLista[i]
    let cachePayload = null

    try {
      const cachedRecords = $app.findRecordsByFilter(
        'cache_previsao',
        "ponto_id = '" + pt.cacheKey + "'",
        '-obtido_em',
        1,
        0,
      )
      if (cachedRecords && cachedRecords.length > 0) {
        cachePayload = cachedRecords[0].get('payload')
      }
    } catch (cErr) {}

    if (
      !cachePayload ||
      !cachePayload.hourly ||
      !Array.isArray(cachePayload.hourly) ||
      cachePayload.hourly.length === 0
    ) {
      continue
    }

    const hourly = cachePayload.hourly
    const daily = cachePayload.daily || []

    // Guarda para varredura de frente fria (próximas 48h)
    for (let h = 0; h < Math.min(hourly.length, 48); h++) {
      all48hHourly.push({
        ponto: pt.nome,
        item: hourly[h],
        prev3h: h >= 3 ? hourly[h - 3] : null,
      })
    }

    // Identifica sunrise e sunset do dia atual
    let sunriseMs = null
    let sunsetMs = null
    for (let d = 0; d < daily.length; d++) {
      const dayItem = daily[d]
      const dateStr = dayItem.date || (dayItem.time ? String(dayItem.time).slice(0, 10) : null)
      if (dateStr === todayDateStr || d === 0) {
        if (dayItem.sunrise) sunriseMs = new Date(dayItem.sunrise).getTime()
        if (dayItem.sunset) sunsetMs = new Date(dayItem.sunset).getTime()
        break
      }
    }

    // Se não tiver astronomia exata, usa 06:00 as 18:00
    const isDaylight = (isoTime) => {
      const tMs = new Date(isoTime).getTime()
      if (sunriseMs && sunsetMs) {
        return tMs >= sunriseMs - 30 * 60 * 1000 && tMs <= sunsetMs + 30 * 60 * 1000
      }
      const hour = new Date(isoTime).getHours()
      return hour >= 6 && hour < 18
    }

    // Itera horas diurnas de HOJE
    const diurnasHoje = []
    for (let h = 0; h < hourly.length; h++) {
      const it = hourly[h]
      const datePart = it.time.slice(0, 10)
      if (datePart === todayDateStr && isDaylight(it.time)) {
        const sc = calcularScoreHora(it, pt.tipo)
        diurnasHoje.push({
          time: it.time,
          score: sc.score,
          fator_limitante_desc: sc.fatorLimitanteDesc,
          item: it,
        })
      }
    }

    // Se hoje já passou ou não pegou diurnas de hoje, pega as primeiras 12 diurnas
    if (diurnasHoje.length === 0) {
      for (let h = 0; h < hourly.length; h++) {
        const it = hourly[h]
        if (isDaylight(it.time)) {
          const sc = calcularScoreHora(it, pt.tipo)
          diurnasHoje.push({
            time: it.time,
            score: sc.score,
            fator_limitante_desc: sc.fatorLimitanteDesc,
            item: it,
          })
          if (diurnasHoje.length >= 12) break
        }
      }
    }

    if (diurnasHoje.length === 0) continue

    let somaScore = 0
    let piorHora = diurnasHoje[0]

    for (let d = 0; d < diurnasHoje.length; d++) {
      somaScore += diurnasHoje[d].score
      if (diurnasHoje[d].score < piorHora.score) {
        piorHora = diurnasHoje[d]
      }
    }

    const scoreMedio = Math.round(somaScore / diurnasHoje.length)

    // Encontra o maior bloco contíguo com score >= 70 nas horas diurnas
    let maxBloco = []
    let currentBloco = []
    for (let d = 0; d < diurnasHoje.length; d++) {
      if (diurnasHoje[d].score >= 70) {
        currentBloco.push(diurnasHoje[d])
      } else {
        if (currentBloco.length > maxBloco.length) {
          maxBloco = currentBloco
        }
        currentBloco = []
      }
    }
    if (currentBloco.length > maxBloco.length) {
      maxBloco = currentBloco
    }

    let janelaInicio = null
    let janelaFim = null
    if (maxBloco.length > 0) {
      janelaInicio = maxBloco[0].time
      janelaFim = maxBloco[maxBloco.length - 1].time
    }

    resultadosPontos.push({
      ponto_nome: pt.nome,
      slug: pt.slug,
      score_medio: scoreMedio,
      janela_inicio: janelaInicio,
      janela_fim: janelaFim,
      pior_fator_limitante: piorHora.fator_limitante_desc || 'vento',
      pior_score: piorHora.score,
    })
  }

  // Se não houver dados suficientes (menos de 2 pontos com dados)
  if (resultadosPontos.length < 2) {
    return e.json(503, { erro: 'Dados insuficientes' })
  }

  // 5. Determinar Melhor Ponto e Ponto a Evitar
  // Melhor ponto: maior score_medio
  let melhorPonto = resultadosPontos[0]
  for (let i = 1; i < resultadosPontos.length; i++) {
    if (resultadosPontos[i].score_medio > melhorPonto.score_medio) {
      melhorPonto = resultadosPontos[i]
    }
  }

  // Ponto a evitar: menor score_medio
  let pontoEvitar = resultadosPontos[0]
  for (let i = 1; i < resultadosPontos.length; i++) {
    if (resultadosPontos[i].score_medio < pontoEvitar.score_medio) {
      pontoEvitar = resultadosPontos[i]
    }
  }

  // 6. Alerta Frente Fria nas próximas 48h
  // Vento S/SW/SSW (157.5 a 247.5 graus) > 15kt OU queda de pressão >= 3 hPa em 3h
  let piorFrenteFriaVento = 0
  let piorFrenteFriaHorario = null
  let piorQuedaPressao = 0
  let piorQuedaHorario = null

  const getMomentoDia = (isoTime) => {
    const h = new Date(isoTime).getHours()
    if (h >= 0 && h < 6) return 'na madrugada'
    if (h >= 6 && h < 12) return 'pela manhã'
    if (h >= 12 && h < 18) return 'à tarde'
    return 'à noite'
  }

  for (let i = 0; i < all48hHourly.length; i++) {
    const entry = all48hHourly[i]
    const it = entry.item
    const wSpeed =
      it.wind_speed_10m !== null && it.wind_speed_10m !== undefined ? it.wind_speed_10m : 0
    const wDir =
      it.wind_direction_10m !== null && it.wind_direction_10m !== undefined
        ? it.wind_direction_10m
        : -1

    // Vento quadrante Sul (157.5 a 247.5) > 15 kt
    if (wDir >= 157.5 && wDir <= 247.5 && wSpeed > 15) {
      if (wSpeed > piorFrenteFriaVento) {
        piorFrenteFriaVento = Math.round(wSpeed)
        piorFrenteFriaHorario = it.time
      }
    }

    // Queda de pressão >= 3 hPa em 3h
    if (entry.prev3h && it.surface_pressure !== null && entry.prev3h.surface_pressure !== null) {
      const deltaPressao = entry.prev3h.surface_pressure - it.surface_pressure
      if (deltaPressao >= 3.0) {
        if (deltaPressao > piorQuedaPressao) {
          piorQuedaPressao = Math.round(deltaPressao * 10) / 10
          piorQuedaHorario = it.time
        }
      }
    }
  }

  let frenteFriaTexto = 'Sem frente fria em 48 h'
  if (piorFrenteFriaVento > 0) {
    const momento = getMomentoDia(piorFrenteFriaHorario)
    frenteFriaTexto = 'Frente fria: vento S ' + piorFrenteFriaVento + ' kt ' + momento
  } else if (piorQuedaPressao >= 3.0) {
    const momento = getMomentoDia(piorQuedaHorario)
    frenteFriaTexto = 'Frente fria: queda rápida de pressão ' + momento
  }

  const responseJson = {
    melhor: {
      ponto_nome: melhorPonto.ponto_nome,
      slug: melhorPonto.slug,
      score_medio: melhorPonto.score_medio,
      janela_inicio: melhorPonto.janela_inicio,
      janela_fim: melhorPonto.janela_fim,
    },
    evitar: {
      ponto_nome: pontoEvitar.ponto_nome,
      slug: pontoEvitar.slug,
      score_medio: pontoEvitar.score_medio,
      fator_limitante: pontoEvitar.pior_fator_limitante,
    },
    frente_fria: frenteFriaTexto,
    atualizado_em: new Date().toISOString(),
  }

  return e.json(200, responseJson)
})
