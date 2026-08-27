routerAdd('GET', '/backend/v1/briefing', (e) => {
  const query = e.requestInfo().query || {}
  const perfilId = query['perfil_id'] || 'lancha'
  const dispositivoUuid = query['dispositivo_uuid'] || ''
  const pontosCustomParam = query['pontos_custom'] || ''

  // 1. Busca os 4 pontos fixos (Angra dos Reis, Abraão, Paraty, Juatinga)
  let pontosRecords = []
  try {
    pontosRecords = $app.findRecordsByFilter('pontos', '', 'created', 10, 0) || []
  } catch (errPontos) {
    pontosRecords = []
  }

  // 2. Busca o perfil de navegação
  let perfilRecord
  try {
    perfilRecord = $app.findRecordById('perfis_navegacao', perfilId)
  } catch (err) {
    try {
      perfilRecord = $app.findFirstRecordByData('perfis_navegacao', 'nome', perfilId)
    } catch (err2) {
      try {
        perfilRecord = $app.findFirstRecordByData('perfis_navegacao', 'nome', 'lancha')
      } catch (err3) {
        // Fallback
      }
    }
  }

  const realPerfilId = perfilRecord ? perfilRecord.id : perfilId
  const perfilNome = perfilRecord ? perfilRecord.get('nome') : perfilId
  const perfilVentoMax = perfilRecord ? Number(perfilRecord.get('vento_max_kt')) || 15 : 15
  const perfilRajadaMax = perfilRecord ? Number(perfilRecord.get('rajada_max_kt')) || 22 : 22
  const perfilOndaMax = perfilRecord ? Number(perfilRecord.get('onda_max_m')) || 1.0 : 1.0
  const rawPeriodoMin = perfilRecord ? perfilRecord.get('periodo_min_s') : null
  const perfilPeriodoMin =
    rawPeriodoMin !== null && rawPeriodoMin !== undefined && Number(rawPeriodoMin) > 0
      ? Number(rawPeriodoMin)
      : null
  const perfilChuvaMax = perfilRecord ? Number(perfilRecord.get('chuva_max_mm_h')) || 4.0 : 4.0

  const resumoPontos = []
  let alertaFrenteFriaDetectado = false

  // Lista unificada de pontos a avaliar no briefing (fixos + personalizados)
  const todosPontosParaAvaliar = []

  for (let pIdx = 0; pIdx < pontosRecords.length; pIdx++) {
    const ponto = pontosRecords[pIdx]
    todosPontosParaAvaliar.push({
      id: ponto.id,
      nome: ponto.get('nome'),
      tipo: ponto.get('tipo') || 'abrigado',
      lat: ponto.get('lat'),
      lon: ponto.get('lon'),
      isPersonalizado: false,
    })
  }

  // Se vierem pontos customizados via query param
  if (pontosCustomParam) {
    try {
      const parsedCustom = JSON.parse(pontosCustomParam)
      if (Array.isArray(parsedCustom)) {
        for (let cIdx = 0; cIdx < parsedCustom.length; cIdx++) {
          const cp = parsedCustom[cIdx]
          if (cp && cp.lat !== undefined && cp.lon !== undefined) {
            let t = (cp.tipo || 'abrigado').toLowerCase()
            if (t === 'semi-abrigado' || t === 'semi') t = 'semi'
            else if (t === 'mar aberto' || t === 'aberto') t = 'aberto'
            else t = 'abrigado'

            todosPontosParaAvaliar.push({
              id: 'custom-' + cIdx,
              nome: cp.nome || 'Ponto Personalizado',
              tipo: t,
              lat: Number(cp.lat),
              lon: Number(cp.lon),
              isPersonalizado: true,
            })
          }
        }
      }
    } catch (parseErr) {
      console.log('Erro ao fazer parse de pontos_custom no briefing:', parseErr)
    }
  }

  if (todosPontosParaAvaliar.length === 0) {
    return e.json(500, { error: 'Nenhum ponto de navegação disponível para gerar o briefing' })
  }

  for (let pIdx = 0; pIdx < todosPontosParaAvaliar.length; pIdx++) {
    const ponto = todosPontosParaAvaliar[pIdx]
    const pId = ponto.id
    const pNome = ponto.nome
    const pTipo = ponto.tipo
    const lat = ponto.lat
    const lon = ponto.lon

    // Consulta previsão 1 dia (para dados atuais)
    let weatherData = null
    let marineData = null

    try {
      const wUrl =
        'https://api.open-meteo.com/v1/forecast?latitude=' +
        encodeURIComponent(lat) +
        '&longitude=' +
        encodeURIComponent(lon) +
        '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility' +
        '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=1'

      const mUrl =
        'https://marine-api.open-meteo.com/v1/marine?latitude=' +
        encodeURIComponent(lat) +
        '&longitude=' +
        encodeURIComponent(lon) +
        '&hourly=wave_height,wave_period,sea_level_height_msl' +
        '&timezone=America%2FSao_Paulo&forecast_days=1'

      const wRes = $http.send({ url: wUrl, method: 'GET', timeout: 15 })
      const mRes = $http.send({ url: mUrl, method: 'GET', timeout: 15 })

      if (wRes.statusCode === 200) weatherData = wRes.json
      if (mRes.statusCode === 200) marineData = mRes.json
    } catch (apiErr) {
      // Ignora erro e continua
    }

    // Acha hora atual
    let curWind = 0
    let curDir = 0
    let curGust = 0
    let curWave = 0
    let curPeriod = 0
    let curRain = 0
    let curSeaLevel = 0

    if (weatherData && weatherData.hourly && weatherData.hourly.time) {
      const times = weatherData.hourly.time
      const windSpeeds = weatherData.hourly.wind_speed_10m || []
      const windDirs = weatherData.hourly.wind_direction_10m || []
      const windGusts = weatherData.hourly.wind_gusts_10m || []
      const precipitations = weatherData.hourly.precipitation || []

      const mTimes = marineData && marineData.hourly ? marineData.hourly.time || [] : []
      const mWaveHeight = marineData && marineData.hourly ? marineData.hourly.wave_height || [] : []
      const mWavePeriod = marineData && marineData.hourly ? marineData.hourly.wave_period || [] : []
      const mSeaLevel =
        marineData && marineData.hourly ? marineData.hourly.sea_level_height_msl || [] : []

      // Índice 0 ou hora mais próxima
      const nowIdx = 0
      curWind = windSpeeds[nowIdx] !== undefined ? windSpeeds[nowIdx] : 0
      curDir = windDirs[nowIdx] !== undefined ? windDirs[nowIdx] : 0
      curGust = windGusts[nowIdx] !== undefined ? windGusts[nowIdx] : 0
      curRain = precipitations[nowIdx] !== undefined ? precipitations[nowIdx] : 0

      curWave = mWaveHeight[nowIdx] !== undefined ? mWaveHeight[nowIdx] : 0
      curPeriod = mWavePeriod[nowIdx] !== undefined ? mWavePeriod[nowIdx] : 0
      curSeaLevel = mSeaLevel[nowIdx] !== undefined ? mSeaLevel[nowIdx] : 0
    }

    // Score atual
    let exposicaoDeducao = 0
    if (pTipo === 'semi') exposicaoDeducao = 10
    else if (pTipo === 'aberto') exposicaoDeducao = 20

    let penalidadeVento = 0
    if (curWind > perfilVentoMax) {
      penalidadeVento = Math.round(Math.min(50, ((curWind - perfilVentoMax) / perfilVentoMax) * 50))
    }
    let penalidadeRajada = 0
    if (curGust > perfilRajadaMax) {
      penalidadeRajada = Math.round(
        Math.min(40, ((curGust - perfilRajadaMax) / perfilRajadaMax) * 40),
      )
    }
    let penalidadeOnda = 0
    if (curWave > perfilOndaMax) {
      penalidadeOnda = Math.round(Math.min(50, ((curWave - perfilOndaMax) / perfilOndaMax) * 50))
    }
    let penalidadePeriodo = 0
    if (perfilPeriodoMin !== null && curPeriod > 0 && curPeriod < perfilPeriodoMin) {
      penalidadePeriodo = Math.round(
        Math.min(30, ((perfilPeriodoMin - curPeriod) / perfilPeriodoMin) * 30),
      )
    }
    let penalidadeChuva = 0
    if (curRain > perfilChuvaMax) {
      penalidadeChuva = Math.round(Math.min(30, ((curRain - perfilChuvaMax) / perfilChuvaMax) * 30))
    }

    let curScore =
      100 -
      penalidadeVento -
      penalidadeRajada -
      penalidadeOnda -
      penalidadePeriodo -
      penalidadeChuva -
      exposicaoDeducao
    if (curScore < 0) curScore = 0
    if (curScore > 100) curScore = 100

    // Checa frente fria (vento S / SW entre 135° e 255° acima de 15kt)
    if (curWind > 15 && curDir >= 135 && curDir <= 255) {
      alertaFrenteFriaDetectado = true
    }

    // Busca janelas do ponto (3 dias)
    let janelasList = []
    try {
      const w3Url =
        'https://api.open-meteo.com/v1/forecast?latitude=' +
        encodeURIComponent(lat) +
        '&longitude=' +
        encodeURIComponent(lon) +
        '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation' +
        '&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=3'

      const m3Url =
        'https://marine-api.open-meteo.com/v1/marine?latitude=' +
        encodeURIComponent(lat) +
        '&longitude=' +
        encodeURIComponent(lon) +
        '&hourly=wave_height,wave_period' +
        '&timezone=America%2FSao_Paulo&forecast_days=3'

      const w3Res = $http.send({ url: w3Url, method: 'GET', timeout: 15 })
      const m3Res = $http.send({ url: m3Url, method: 'GET', timeout: 15 })

      if (w3Res.statusCode === 200 && m3Res.statusCode === 200) {
        const w3 = w3Res.json
        const m3 = m3Res.json
        const times3 = w3.hourly.time || []
        const ws3 = w3.hourly.wind_speed_10m || []
        const wg3 = w3.hourly.wind_gusts_10m || []
        const wd3 = w3.hourly.wind_direction_10m || []
        const pr3 = w3.hourly.precipitation || []
        const wh3 = m3.hourly.wave_height || []
        const wp3 = m3.hourly.wave_period || []

        let cJanela = []
        for (let i = 0; i < times3.length; i++) {
          const wind3 = ws3[i] !== undefined ? ws3[i] : 0
          const gust3 = wg3[i] !== undefined ? wg3[i] : 0
          const rain3 = pr3[i] !== undefined ? pr3[i] : 0
          const wave3 = wh3[i] !== undefined ? wh3[i] : 0
          const dir3 = wd3[i] !== undefined ? wd3[i] : 0
          const per3 = wp3[i] !== undefined ? wp3[i] : 0

          if (wind3 > 15 && dir3 >= 135 && dir3 <= 255) {
            alertaFrenteFriaDetectado = true
          }

          let pv = 0
          if (wind3 > perfilVentoMax)
            pv = Math.round(Math.min(50, ((wind3 - perfilVentoMax) / perfilVentoMax) * 50))
          let pg = 0
          if (gust3 > perfilRajadaMax)
            pg = Math.round(Math.min(40, ((gust3 - perfilRajadaMax) / perfilRajadaMax) * 40))
          let po = 0
          if (wave3 > perfilOndaMax)
            po = Math.round(Math.min(50, ((wave3 - perfilOndaMax) / perfilOndaMax) * 50))
          let pp = 0
          if (perfilPeriodoMin !== null && per3 > 0 && per3 < perfilPeriodoMin)
            pp = Math.round(Math.min(30, ((perfilPeriodoMin - per3) / perfilPeriodoMin) * 30))
          let pc = 0
          if (rain3 > perfilChuvaMax)
            pc = Math.round(Math.min(30, ((rain3 - perfilChuvaMax) / perfilChuvaMax) * 30))

          let sc = 100 - pv - pg - po - pp - pc - exposicaoDeducao
          if (sc < 0) sc = 0
          if (sc > 100) sc = 100

          let fl = null
          if (sc < 90) {
            if (pv >= pg && pv >= po && pv > 0) fl = 'vento ' + Math.round(wind3) + 'kt'
            else if (pg >= pv && pg >= po && pg > 0) fl = 'rajada ' + Math.round(gust3) + 'kt'
            else if (po > 0) fl = 'onda ' + (wave3 ? wave3.toFixed(1) : '0') + 'm'
            else if (pc > 0) fl = 'chuva'
            else if (exposicaoDeducao > 0) fl = 'exposição'
          }

          if (sc >= 70) {
            cJanela.push({ time: times3[i], score: sc, fl: fl })
          } else {
            if (cJanela.length >= 3) {
              let sum = 0
              for (let k = 0; k < cJanela.length; k++) sum += cJanela[k].score
              janelasList.push({
                inicio: cJanela[0].time,
                fim: cJanela[cJanela.length - 1].time,
                duracao: cJanela.length,
                score_medio: Math.round(sum / cJanela.length),
                fator_limitante: cJanela[0].fl || 'condições ideais',
              })
            }
            cJanela = []
          }
        }
        if (cJanela.length >= 3) {
          let sum = 0
          for (let k = 0; k < cJanela.length; k++) sum += cJanela[k].score
          janelasList.push({
            inicio: cJanela[0].time,
            fim: cJanela[cJanela.length - 1].time,
            duracao: cJanela.length,
            score_medio: Math.round(sum / cJanela.length),
            fator_limitante: cJanela[0].fl || 'condições ideais',
          })
        }
      }
    } catch (jErr) {
      // Ignora erro
    }

    resumoPontos.push({
      ponto: pNome,
      tipo: pTipo,
      vento_kt: Math.round(curWind),
      direcao_deg: Math.round(curDir),
      rajada_kt: Math.round(curGust),
      onda_m: curWave !== null ? Number(curWave).toFixed(1) : '0.0',
      periodo_s: curPeriod !== null ? Math.round(curPeriod) : 0,
      chuva_mm: curRain !== null ? Number(curRain).toFixed(1) : '0.0',
      mare_m: curSeaLevel !== null ? Number(curSeaLevel).toFixed(2) : '0.00',
      score_atual: curScore,
      janelas_ideais: janelasList.slice(0, 3),
    })
  }

  // 3. Monta prompt para IA do Skip ($ai.chat)
  const systemPrompt =
    'Você é um comandante experiente da Baía de Ilha Grande. Com base nos dados abaixo, escreva um briefing de no máximo 5 linhas em português, direto e objetivo, com: (1) recomendação do melhor ponto e janela para navegar, (2) ponto a evitar e motivo, (3) alerta de frente fria se houver vento de S ou SW acima de 15 kt em qualquer ponto. Não use introduções nem saudações — vá direto ao ponto.'

  const userPrompt =
    'Perfil da embarcação: ' +
    perfilNome +
    '\n' +
    'Frente fria detectada nos dados: ' +
    (alertaFrenteFriaDetectado ? 'SIM (vento S/SW > 15kt)' : 'NÃO') +
    '\n\n' +
    'Resumo meteorológico dos pontos:\n' +
    JSON.stringify(resumoPontos, null, 2)

  let briefingTexto = ''

  try {
    const aiResponse = $ai.chat({
      model: 'fast',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    if (
      aiResponse &&
      aiResponse.choices &&
      aiResponse.choices.length > 0 &&
      aiResponse.choices[0].message
    ) {
      briefingTexto = (aiResponse.choices[0].message.content || '').trim()
    }
  } catch (aiErr) {
    console.log('Erro ao chamar $ai.chat:', aiErr && aiErr.message ? aiErr.message : String(aiErr))
    // Fallback inteligente caso a IA falhe
    let melhorPonto = resumoPontos[0]
    let piorPonto = resumoPontos[0]
    for (let i = 1; i < resumoPontos.length; i++) {
      if (resumoPontos[i].score_atual > melhorPonto.score_atual) melhorPonto = resumoPontos[i]
      if (resumoPontos[i].score_atual < piorPonto.score_atual) piorPonto = resumoPontos[i]
    }

    briefingTexto =
      'Melhor opção para ' +
      perfilNome +
      ': ' +
      melhorPonto.ponto +
      ' com score ' +
      melhorPonto.score_atual +
      '/100 e vento ' +
      melhorPonto.vento_kt +
      ' kt.\n' +
      'Evite ' +
      piorPonto.ponto +
      ' devido a condições mais agitadas (score ' +
      piorPonto.score_atual +
      '/100, onda ' +
      piorPonto.onda_m +
      ' m).\n' +
      (alertaFrenteFriaDetectado
        ? 'Atenção: Alerta de vento sul/sudoeste acima de 15 nós na região.'
        : 'Condições gerais estáveis na Baía de Ilha Grande.')
  }

  const agoraIso = new Date().toISOString()

  // 4. Salva no campo ultimo_briefing da collection preferencias se houver dispositivo_uuid
  if (dispositivoUuid) {
    try {
      const prefsRecords = $app.findRecordsByFilter(
        'preferencias',
        "dispositivo_uuid = '" + dispositivoUuid + "'",
        '-created',
        1,
        0,
      )
      if (prefsRecords && prefsRecords.length > 0) {
        const pref = prefsRecords[0]
        pref.set('ultimo_briefing', briefingTexto)
        $app.save(pref)
      } else {
        const prefsCol = $app.findCollectionByNameOrId('preferencias')
        const newPref = new Record(prefsCol)
        newPref.set('dispositivo_uuid', dispositivoUuid)
        newPref.set('perfil_id', realPerfilId)
        newPref.set('ultimo_briefing', briefingTexto)
        newPref.set('criado_em', agoraIso.replace('T', ' '))
        $app.save(newPref)
      }
    } catch (savePrefErr) {
      console.log(
        'Erro ao salvar ultimo_briefing em preferencias:',
        savePrefErr && savePrefErr.message ? savePrefErr.message : String(savePrefErr),
      )
    }
  }

  return e.json(200, {
    texto: briefingTexto,
    gerado_em: agoraIso,
  })
})
