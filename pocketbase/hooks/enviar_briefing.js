routerAdd('POST', '/backend/v1/enviar-briefing', (e) => {
  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    return e.json(400, { error: 'Corpo da requisição inválido' })
  }

  const destinatario = (body.destinatario || '').trim()
  const briefing = (body.briefing || '').trim()
  const data = (body.data || '').trim() || new Date().toLocaleDateString('pt-BR')

  if (!destinatario) {
    return e.json(400, { error: 'E-mail do destinatário é obrigatório' })
  }

  // Validação básica de e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(destinatario)) {
    return e.json(400, { error: 'Formato de e-mail inválido' })
  }

  if (!briefing) {
    return e.json(400, { error: 'Texto do briefing é obrigatório' })
  }

  const subject = 'Briefing náutico — ' + data
  const disclaimer =
    'Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN.\nClima Náutico — Baía de Ilha Grande'
  const textBody = 'Briefing do Comandante — ' + data + '\n\n' + briefing + '\n\n---\n' + disclaimer

  const htmlBody =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b1118; color: #e4e4e7; padding: 24px; border-radius: 12px; border: 1px solid #164e63;">' +
    '<h2 style="color: #38bdf8; margin-top: 0; font-size: 20px; display: flex; align-items: center; gap: 8px;">⚓ Clima Náutico — Briefing do Comandante</h2>' +
    '<p style="color: #94a3b8; font-size: 13px; margin-bottom: 20px;">Data de referência: ' +
    data +
    '</p>' +
    '<div style="background-color: #030712; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 20px; white-space: pre-line; line-height: 1.6; color: #f1f5f9; font-size: 14px;">' +
    briefing +
    '</div>' +
    '<div style="border-top: 1px solid #1e293b; padding-top: 14px; font-size: 11px; color: #64748b; line-height: 1.4;">' +
    'Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN.<br/>' +
    'Clima Náutico · Baía de Ilha Grande' +
    '</div>' +
    '</div>'

  try {
    let senderAddress = 'no-reply@climanautico.app'
    let senderName = 'Clima Náutico'
    try {
      const meta = $app.settings().meta
      if (meta) {
        if (meta.senderAddress) senderAddress = meta.senderAddress
        if (meta.senderName) senderName = meta.senderName
      }
    } catch (_) {}

    const message = new MailerMessage({
      from: {
        address: senderAddress,
        name: senderName,
      },
      to: [{ address: destinatario }],
      subject: subject,
      text: textBody,
      html: htmlBody,
    })

    $app.newMailClient().send(message)

    return e.json(200, {
      success: true,
      message: 'Briefing enviado com sucesso para ' + destinatario,
    })
  } catch (mailErr) {
    console.log(
      'Erro ao enviar e-mail:',
      mailErr && mailErr.message ? mailErr.message : String(mailErr),
    )
    return e.json(500, {
      error:
        'Falha ao enviar e-mail: ' +
        (mailErr && mailErr.message ? mailErr.message : String(mailErr)),
    })
  }
})
