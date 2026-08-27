const DEVICE_ID_KEY = 'clima_nautico_device_id'

export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'default-device-id'
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (deviceId && deviceId.trim().length > 0) {
      return deviceId
    }

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      deviceId = crypto.randomUUID()
    } else {
      // Fallback manual de UUID v4
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }

    localStorage.setItem(DEVICE_ID_KEY, deviceId)
    return deviceId
  } catch (err) {
    console.warn('Erro ao acessar localStorage para deviceId:', err)
    return 'fallback-device-id'
  }
}
