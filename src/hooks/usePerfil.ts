import { useState, useEffect, useCallback } from 'react'
import { PerfilNavegacao, PreferenciasUsuario } from '@/types/nautico'
import { getDeviceId } from '@/lib/deviceId'
import {
  fetchPerfis,
  fetchPreferenciasPorDispositivo,
  salvarPreferenciasDispositivo,
} from '@/services/previsaoService'

export function usePerfilInternal() {
  const [deviceId] = useState<string>(() => getDeviceId())
  const [perfis, setPerfis] = useState<PerfilNavegacao[]>([])
  const [perfil, setPerfilState] = useState<PerfilNavegacao | null>(null)
  const [preferencias, setPreferencias] = useState<PreferenciasUsuario | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const inicializar = useCallback(async () => {
    setLoading(true)
    try {
      const perfisData = await fetchPerfis()
      setPerfis(perfisData)

      const id = deviceId || getDeviceId()
      const prefs = await fetchPreferenciasPorDispositivo(id)

      let selectedPerfil: PerfilNavegacao | null = null

      if (prefs && prefs.perfil_id) {
        selectedPerfil =
          perfisData.find((p) => p.id === prefs.perfil_id || p.nome === prefs.perfil_id) || null
      }

      // Se não existir, seleciona o primeiro (lancha) e persiste
      if (!selectedPerfil && perfisData.length > 0) {
        selectedPerfil = perfisData[0]
        try {
          const created = await salvarPreferenciasDispositivo(id, selectedPerfil.id)
          setPreferencias(created)
        } catch (err) {
          console.warn('Falha ao persistir preferencia inicial:', err)
        }
      } else {
        setPreferencias(prefs)
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
        const id = deviceId || getDeviceId()
        try {
          const updated = await salvarPreferenciasDispositivo(id, match.id)
          setPreferencias(updated)
        } catch (err) {
          console.warn('Erro ao salvar nova preferencia de perfil:', err)
        }
      }
    },
    [perfis, perfil, deviceId],
  )

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
    preferencias,
    reload: inicializar,
  }
}
