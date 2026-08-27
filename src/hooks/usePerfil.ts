import { useState, useEffect, useCallback } from 'react'
import { PerfilNavegacao, PreferenciasStorage, PreferenciasUsuario } from '@/types/nautico'
import { getDeviceId } from '@/lib/deviceId'
import { fetchPerfis } from '@/services/previsaoService'
import {
  inicializarPreferencias,
  setStoredPreferences,
  getStoredPreferences,
} from '@/lib/preferencesStorage'

export function usePerfilInternal() {
  const [deviceId] = useState<string>(() => getDeviceId())
  const [perfis, setPerfis] = useState<PerfilNavegacao[]>([])
  const [perfil, setPerfilState] = useState<PerfilNavegacao | null>(null)
  const [preferenciasStorage, setPreferenciasStorage] = useState<PreferenciasStorage | null>(() =>
    getStoredPreferences(),
  )
  const [loading, setLoading] = useState<boolean>(true)

  const inicializar = useCallback(async () => {
    setLoading(true)
    try {
      const perfisData = await fetchPerfis()
      setPerfis(perfisData)

      const id = deviceId || getDeviceId()
      const prefs = await inicializarPreferencias(id)
      setPreferenciasStorage(prefs)

      let selectedPerfil: PerfilNavegacao | null = null

      if (prefs && prefs.perfil_id) {
        selectedPerfil =
          perfisData.find((p) => p.id === prefs.perfil_id || p.nome === prefs.perfil_id) || null
      }

      // Se não existir, seleciona o primeiro (lancha) e persiste
      if (!selectedPerfil && perfisData.length > 0) {
        selectedPerfil = perfisData[0]
        const updated = setStoredPreferences({ perfil_id: selectedPerfil.id })
        setPreferenciasStorage(updated)
      }

      setPerfilState(selectedPerfil)
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      // Fallback
      setPerfilState({
        id: 'lancha',
        nome: 'lancha',
        vento_max_kt: 15,
        rajada_max_kt: 22,
        onda_max_m: 1.0,
        periodo_min_s: null,
        chuva_max_mm_h: 4,
      })
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    inicializar()
  }, [inicializar])

  const setPerfil = useCallback(
    async (perfilIdOuNome: string) => {
      const match =
        perfis.find((p) => p.id === perfilIdOuNome || p.nome === perfilIdOuNome) ||
        (perfil && (perfil.id === perfilIdOuNome || perfil.nome === perfilIdOuNome) ? perfil : null)

      if (match) {
        setPerfilState(match)
        const updated = setStoredPreferences({ perfil_id: match.id })
        setPreferenciasStorage(updated)
      }
    },
    [perfis, perfil],
  )

  const salvarUltimoBriefing = useCallback((texto: string) => {
    const timestamp = new Date().toISOString()
    const updated = setStoredPreferences({
      ultimo_briefing: { texto, timestamp },
    })
    setPreferenciasStorage(updated)
  }, [])

  return {
    deviceId,
    perfis,
    perfil:
      perfil ||
      ({
        id: 'lancha',
        nome: 'lancha',
        vento_max_kt: 15,
        rajada_max_kt: 22,
        onda_max_m: 1.0,
        periodo_min_s: null,
        chuva_max_mm_h: 4,
      } as PerfilNavegacao),
    setPerfil,
    loading,
    preferencias: preferenciasStorage
      ? ({
          dispositivo_uuid: deviceId,
          perfil_id: preferenciasStorage.perfil_id,
          ponto_favorito_id: preferenciasStorage.ponto_favorito_slug,
          ponto_favorito_slug: preferenciasStorage.ponto_favorito_slug,
          horario_briefing: preferenciasStorage.horario_briefing,
          ultimo_briefing: preferenciasStorage.ultimo_briefing?.texto,
          updated: preferenciasStorage.ultimo_briefing?.timestamp,
        } as PreferenciasUsuario)
      : null,
    preferenciasStorage,
    salvarUltimoBriefing,
    reload: inicializar,
  }
}
