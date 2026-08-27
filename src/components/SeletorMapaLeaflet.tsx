import React, { useEffect, useMemo, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Button } from '@/components/ui/button'
import { Navigation, Plus, Minus, AlertTriangle, Crosshair } from 'lucide-react'
import { PontoPersonalizado } from '@/types/nautico'
import { PONTOS_DISPONIVEIS } from '@/services/previsaoService'

// Criação de ícones customizados SVG para evitar problemas com assets padrão do Leaflet
const createCustomIcon = (options: {
  bg: string
  border: string
  emoji?: string
  dotColor?: string
  isCurrent?: boolean
  isError?: boolean
}) => {
  const size = options.isCurrent ? 36 : 28
  const anchor = size / 2

  const borderCol = options.isError ? '#ef4444' : options.border
  const bgCol = options.isError ? '#7f1d1d' : options.bg

  let innerContent = ''
  if (options.isError) {
    innerContent = `<span style="color:#fca5a5; font-size:16px; font-weight:bold; line-height:1;">✕</span>`
  } else if (options.emoji) {
    innerContent = `<span style="font-size:14px; line-height:1;">${options.emoji}</span>`
  } else if (options.dotColor) {
    innerContent = `<div style="width:10px; height:10px; border-radius:50%; background:${options.dotColor};"></div>`
  } else {
    innerContent = `<div style="width:10px; height:10px; border-radius:50%; background:#06b6d4;"></div>`
  }

  const pulseRing = options.isCurrent
    ? `<div style="position:absolute; width:100%; height:100%; border-radius:50%; border:2px solid ${borderCol}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity:0.6; pointer-events:none;"></div>`
    : ''

  const html = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
      ${pulseRing}
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:${bgCol};
        border:2.5px solid ${borderCol};
        box-shadow: 0 4px 12px rgba(0,0,0,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        transition: transform 0.15s ease;
      ">
        ${innerContent}
      </div>
    </div>
  `

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: html,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor - 4],
  })
}

// Subcomponente de Eventos do Mapa (clique e controle)
interface MapControllerProps {
  position: [number, number] | null
  onPositionChange: (lat: number, lon: number) => void
}

function MapEventsHandler({
  onPositionChange,
}: {
  onPositionChange: (lat: number, lon: number) => void
}) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Ajuste automático de centro e resize
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center)
  }, [center, map])

  useEffect(() => {
    // Invalida tamanho do container para renderizar tiles corretamente dentro do modal Dialog
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)
    return () => clearTimeout(timer)
  }, [map])

  return null
}

// Controles Customizados de Zoom Grandes
function CustomZoomControls() {
  const map = useMap()

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5 shadow-lg">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation()
          map.zoomIn()
        }}
        className="h-9 w-9 rounded-lg bg-[#0f1722]/90 hover:bg-[#1a2636] border border-cyan-800/60 text-cyan-300 backdrop-blur-md shadow-md"
        title="Aumentar zoom"
      >
        <Plus className="w-5 h-5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={(e) => {
          e.stopPropagation()
          map.zoomOut()
        }}
        className="h-9 w-9 rounded-lg bg-[#0f1722]/90 hover:bg-[#1a2636] border border-cyan-800/60 text-cyan-300 backdrop-blur-md shadow-md"
        title="Diminuir zoom"
      >
        <Minus className="w-5 h-5" />
      </Button>
    </div>
  )
}

interface SeletorMapaProps {
  lat: number | null
  lon: number | null
  onChange: (lat: number, lon: number) => void
  pontosExistentes?: PontoPersonalizado[]
  pontoEditandoId?: string | null
  isTerraError?: boolean
  onMinhaLocalizacao?: () => void
  geoLoading?: boolean
}

export const SeletorMapaLeaflet: React.FC<SeletorMapaProps> = ({
  lat,
  lon,
  onChange,
  pontosExistentes = [],
  pontoEditandoId,
  isTerraError = false,
  onMinhaLocalizacao,
  geoLoading = false,
}) => {
  // Centro padrão: Baía de Ilha Grande (-23.10, -44.40, zoom 10)
  const defaultCenter: [number, number] = useMemo(() => [-23.1, -44.4], [])

  const currentPos: [number, number] | null = useMemo(() => {
    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      return [lat, lon]
    }
    return null
  }, [lat, lon])

  const mapCenter: [number, number] = useMemo(() => {
    if (currentPos) return currentPos
    return defaultCenter
  }, [currentPos, defaultCenter])

  // Marcador selecionado arrastável
  const markerRef = useRef<L.Marker | null>(null)

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          const newLatLng = marker.getLatLng()
          onChange(newLatLng.lat, newLatLng.lng)
        }
      },
    }),
    [onChange],
  )

  // Ícones
  const currentIcon = useMemo(() => {
    return createCustomIcon({
      bg: isTerraError ? '#7f1d1d' : '#083344',
      border: isTerraError ? '#ef4444' : '#06b6d4',
      dotColor: isTerraError ? '#f87171' : '#22d3ee',
      isCurrent: true,
      isError: isTerraError,
    })
  }, [isTerraError])

  const fixedIcon = useMemo(() => {
    return createCustomIcon({
      bg: '#27272a',
      border: '#71717a',
      dotColor: '#a1a1aa',
    })
  }, [])

  const customStarIcon = useMemo(() => {
    return createCustomIcon({
      bg: '#1e1b4b',
      border: '#6366f1',
      emoji: '⭐',
    })
  }, [])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-zinc-700/80 bg-[#070b10] shadow-inner">
      {/* Container Leaflet - Altura mínima 320px */}
      <div className="w-full h-[320px] sm:h-[360px] relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={10}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', background: '#0a1017' }}
        >
          {/* Camada Base: OpenStreetMap */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />

          {/* Camada Náutica: OpenSeaMap (boias, faróis, profundidades, marinas) */}
          <TileLayer
            attribution='&copy; <a href="http://www.openseamap.org">OpenSeaMap</a>'
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            maxZoom={18}
          />

          <MapRecenter center={mapCenter} />
          <MapEventsHandler onPositionChange={onChange} />
          <CustomZoomControls />

          {/* 1. Pontos Fixos Canônicos (Marcadores Cinza) */}
          {PONTOS_DISPONIVEIS.map((p) => (
            <Marker
              key={`fixo-${p.slug}`}
              position={[p.lat, p.lon]}
              icon={fixedIcon}
              eventHandlers={{
                click: () => {
                  onChange(p.lat, p.lon)
                },
              }}
            >
              <Popup className="custom-popup">
                <div className="text-xs text-zinc-900 font-sans">
                  <strong className="block text-zinc-950 font-bold">{p.nomeCompleto}</strong>
                  <span className="text-[11px] text-zinc-600 block">Ponto fixo ({p.tipo})</span>
                  <span className="text-[10px] text-cyan-800 font-mono block mt-1">
                    {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 2. Pontos Personalizados Existentes (Marcadores com Estrela ⭐) */}
          {pontosExistentes
            .filter((p) => p.id !== pontoEditandoId)
            .map((p) => (
              <Marker
                key={`custom-${p.id}`}
                position={[p.lat, p.lon]}
                icon={customStarIcon}
                eventHandlers={{
                  click: () => {
                    onChange(p.lat, p.lon)
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="text-xs text-zinc-900 font-sans">
                    <strong className="block text-zinc-950 font-bold">⭐ {p.nome}</strong>
                    <span className="text-[11px] text-zinc-600 block">
                      Personalizado ({p.tipo})
                    </span>
                    <span className="text-[10px] text-indigo-800 font-mono block mt-1">
                      {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* 3. Marcador da Posição Selecionada (Arrastável / Interativo) */}
          {currentPos && (
            <Marker
              position={currentPos}
              draggable={true}
              eventHandlers={eventHandlers}
              ref={markerRef}
              icon={currentIcon}
              zIndexOffset={1000}
            >
              <Popup className="custom-popup" autoPan={false}>
                <div className="text-xs text-zinc-900 font-sans">
                  <strong className="block text-cyan-950 font-bold">
                    {isTerraError ? 'Posição em terra!' : 'Posição Selecionada'}
                  </strong>
                  <span className="text-[10px] text-zinc-600 block">
                    {isTerraError ? 'Arraste para o mar' : 'Arraste para ajuste fino'}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Botão "Minha localização" SOBRE o mapa */}
      {onMinhaLocalizacao && (
        <div className="absolute left-3 bottom-3 z-[1000]">
          <Button
            type="button"
            size="sm"
            onClick={onMinhaLocalizacao}
            disabled={geoLoading}
            className="bg-[#0f1722]/95 hover:bg-[#1a2636] border border-cyan-700/80 text-cyan-300 text-xs gap-1.5 h-8 px-3 shadow-lg backdrop-blur-md font-medium"
          >
            {geoLoading ? (
              <Crosshair className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
            Minha localização
          </Button>
        </div>
      )}

      {/* Feedback de Posição em Terra SOBRE o mapa */}
      {isTerraError && (
        <div className="absolute top-3 left-3 right-16 z-[1000] p-2.5 rounded-lg bg-red-950/90 border border-red-600 text-red-200 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in-50 duration-200">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-semibold text-[11px] leading-tight">
            Esta posição parece estar em terra — ajuste para o mar
          </span>
        </div>
      )}

      {/* Dica de toque no rodapé do mapa */}
      {!isTerraError && !currentPos && (
        <div className="absolute bottom-3 right-3 z-[1000] pointer-events-none bg-black/70 px-2.5 py-1 rounded-md text-[10px] text-zinc-300 border border-zinc-700/60 backdrop-blur-sm">
          Toque no mapa para posicionar
        </div>
      )}
    </div>
  )
}
export default SeletorMapaLeaflet
