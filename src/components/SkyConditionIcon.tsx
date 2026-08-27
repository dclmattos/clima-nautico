import React from 'react'
import {
  Sun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudLightning,
  CloudOff,
  CloudSnow,
} from 'lucide-react'

export type SkyIconType =
  | 'Sun'
  | 'CloudSun'
  | 'Cloud'
  | 'CloudFog'
  | 'CloudDrizzle'
  | 'CloudRain'
  | 'CloudSnow'
  | 'CloudLightning'
  | 'CloudOff'

export interface SkyCondition {
  iconName: SkyIconType
  label: string
  isStorm?: boolean
}

export const SKY_PALETTE = {
  sunGold: '#F5C542',
  cloudGrey: '#8A9BB0',
  rainBlue: '#4FA3E3',
  stormViolet: '#A78BFA',
  offGrey: '#71717A',
} as const

interface SkyConditionIconProps {
  iconName: SkyIconType
  className?: string
  size?: number
}

/**
 * Ícone customizado de Sol com Nuvem (weather_code 2)
 * Sol em #F5C542 e a nuvem em cinza-azulado (#8A9BB0)
 * Baseado no path do Lucide CloudSun
 */
export const SunCloudBicolorIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Elementos do Sol em #F5C542 */}
      <g stroke={SKY_PALETTE.sunGold}>
        <path d="M12 2v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="M20 12h2" />
        <path d="m19.07 4.93-1.41 1.41" />
        <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
      </g>
      {/* Nuvem em cinza (#8A9BB0) */}
      <g stroke={SKY_PALETTE.cloudGrey}>
        <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
      </g>
    </svg>
  )
}

export const SkyConditionIcon: React.FC<SkyConditionIconProps> = ({
  iconName,
  className = 'w-4 h-4',
}) => {
  switch (iconName) {
    case 'Sun':
      return <Sun className={className} style={{ color: SKY_PALETTE.sunGold }} />
    case 'CloudSun':
      return <SunCloudBicolorIcon className={className} />
    case 'Cloud':
      return <Cloud className={className} style={{ color: SKY_PALETTE.cloudGrey }} />
    case 'CloudFog':
      return <CloudFog className={className} style={{ color: SKY_PALETTE.cloudGrey }} />
    case 'CloudDrizzle':
      return <CloudDrizzle className={className} style={{ color: SKY_PALETTE.rainBlue }} />
    case 'CloudRain':
      return <CloudRain className={className} style={{ color: SKY_PALETTE.rainBlue }} />
    case 'CloudSnow':
      return <CloudSnow className={className} style={{ color: SKY_PALETTE.rainBlue }} />
    case 'CloudLightning':
      return <CloudLightning className={className} style={{ color: SKY_PALETTE.stormViolet }} />
    case 'CloudOff':
    default:
      return <CloudOff className={className} style={{ color: SKY_PALETTE.offGrey }} />
  }
}
