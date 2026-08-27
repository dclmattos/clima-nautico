import React, { createContext, useContext } from 'react'
import { PerfilNavegacao, PreferenciasStorage, PreferenciasUsuario } from '@/types/nautico'
import { usePerfilInternal } from '@/hooks/usePerfil'

interface PerfilContextType {
  deviceId: string
  perfis: PerfilNavegacao[]
  perfil: PerfilNavegacao
  setPerfil: (idOuNome: string) => Promise<void>
  loading: boolean
  preferencias: PreferenciasUsuario | null
  preferenciasStorage?: PreferenciasStorage | null
  salvarUltimoBriefing?: (texto: string) => void
  reload: () => Promise<void>
}

const PerfilContext = createContext<PerfilContextType | null>(null)

export const PerfilProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const perfilData = usePerfilInternal()

  return <PerfilContext.Provider value={perfilData}>{children}</PerfilContext.Provider>
}

export function usePerfil(): PerfilContextType {
  const context = useContext(PerfilContext)
  if (!context) {
    throw new Error('usePerfil deve ser utilizado dentro de um PerfilProvider')
  }
  return context
}
