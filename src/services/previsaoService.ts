import pb from '@/lib/pocketbase/client'
import { Ponto, PrevisaoPayload, PrevisaoHoraItem } from '@/types/nautico'

export async function fetchPontos(): Promise<Ponto[]> {
  try {
    const records = await pb.collection('pontos').getFullList<Ponto>({
      sort: 'created',
    })
    return records
  } catch (err: any) {
    console.error('Erro ao buscar pontos do PocketBase:', err)
    throw new Error(err?.message || 'Falha ao carregar lista de pontos')
  }
}

export async function fetchPrevisaoPorPonto(pontoId: string): Promise<PrevisaoPayload> {
  const backendUrl = pb.baseUrl || ''
  const url = `${backendUrl}/backend/v1/previsao?ponto_id=${encodeURIComponent(pontoId)}`

  const res = await fetch(url)
  if (!res.ok) {
    let errorDetail = 'Falha ao obter previsão'
    try {
      const errJson = await res.json()
      if (errJson?.error) {
        errorDetail = errJson.error
      }
    } catch {
      errorDetail = `Erro no servidor (${res.status})`
    }
    throw new Error(errorDetail)
  }

  const data: PrevisaoPayload = await res.json()
  return data
}

/**
 * Encontra o item de previsão da hora atual mais próximo
 */
export function getCurrentHourForecast(hourly: PrevisaoHoraItem[]): PrevisaoHoraItem | null {
  if (!hourly || hourly.length === 0) return null

  // Obter hora atual local (UTC-3 / America/Sao_Paulo)
  const now = new Date()

  // Format local YYYY-MM-DDTHH
  const nowYear = now.getFullYear()
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0')
  const nowDate = String(now.getDate()).padStart(2, '0')
  const nowHours = String(now.getHours()).padStart(2, '0')
  const targetPrefix = `${nowYear}-${nowMonth}-${nowDate}T${nowHours}:00`

  // Busca exata pela hora
  const exact = hourly.find((item) => item.time.startsWith(targetPrefix))
  if (exact) return exact

  // Se não encontrou exato (ex: virada de dia ou fuso), encontra a hora com menor diferença temporal absoluta
  const nowMs = now.getTime()
  let closestItem: PrevisaoHoraItem = hourly[0]
  let minDiff = Infinity

  for (const item of hourly) {
    const itemDate = new Date(item.time)
    const diff = Math.abs(itemDate.getTime() - nowMs)
    if (diff < minDiff) {
      minDiff = diff
      closestItem = item
    }
  }

  return closestItem
}

/**
 * Semáforo simplificado:
 * verde se vento ≤ 10kt e onda ≤ 0.5m
 * amarelo se vento ≤ 20kt e onda ≤ 1.5m
 * vermelho se acima
 */
export function calculateSemaforo(
  current: PrevisaoHoraItem | null,
): 'verde' | 'amarelo' | 'vermelho' {
  if (!current) return 'verde'

  const vento = current.wind_speed_10m ?? 0
  const onda = current.wave_height ?? 0

  if (vento <= 10 && onda <= 0.5) {
    return 'verde'
  }
  if (vento <= 20 && onda <= 1.5) {
    return 'amarelo'
  }
  return 'vermelho'
}

/**
 * Converte graus de direção em rótulo cardinal (N, NE, E, SE, S, SW, W, NW)
 */
export function getWindDirectionLabel(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined) return '--'
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
  const index = Math.round((degrees % 360) / 22.5) % 16
  return dirs[index]
}

/**
 * Formata nome de exibição do ponto
 */
export function formatPontoNome(nome: string): string {
  const map: Record<string, string> = {
    angra: 'Angra dos Reis',
    abraao: 'Vila do Abraão (Ilha Grande)',
    paraty: 'Paraty',
    juatinga: 'Ponta da Juatinga',
  }
  return map[nome.toLowerCase()] || nome.charAt(0).toUpperCase() + nome.slice(1)
}

/**
 * Formata badge do tipo
 */
export function formatTipoPonto(tipo: string): string {
  const map: Record<string, string> = {
    abrigado: 'Abrigado',
    semi: 'Semi-abrigado',
    aberto: 'Aberto',
  }
  return map[tipo] || tipo
}
