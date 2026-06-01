import { useState, useEffect, useCallback } from 'react'

export interface ForecastDay {
  date: string
  tempMax: number
  tempMin: number
  weatherCode: number
  precipMm: number
}

export interface WeatherData {
  location: string
  lat: number
  lon: number
  temp: number
  feelsLike: number
  humidity: number
  windKph: number
  weatherCode: number
  isDay: boolean
  tempMax: number
  tempMin: number
  forecast: ForecastDay[]
  fetchedAt: number
}

export type WeatherStatus = 'idle' | 'locating' | 'loading' | 'success' | 'error'

const CACHE_KEY = 'taskpro-weather-v1'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function loadCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as WeatherData
    if (Date.now() - data.fetchedAt > CACHE_TTL) return null
    return data
  } catch { return null }
}

function saveCache(data: WeatherData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: false })
  )
}

async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum` +
    `&timezone=auto&forecast_days=5`

  const [geoResult, weatherRes] = await Promise.allSettled([
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`),
    fetch(weatherUrl),
  ])

  // Location name (graceful fallback)
  let location = 'Vị trí hiện tại'
  if (geoResult.status === 'fulfilled' && geoResult.value.ok) {
    try {
      const geoData = await geoResult.value.json()
      const addr = geoData.address ?? {}
      const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? ''
      const country = addr.country ?? ''
      location = city || 'Vị trí hiện tại'
      if (country && country !== 'Việt Nam' && city) location += `, ${country}`
    } catch { /* keep default */ }
  }

  if (weatherRes.status === 'rejected' || !weatherRes.value.ok) {
    throw new Error('Không thể tải dữ liệu thời tiết')
  }
  const wd = await weatherRes.value.json()
  const cur   = wd.current
  const daily = wd.daily

  return {
    location,
    lat, lon,
    temp:        Math.round(cur.temperature_2m),
    feelsLike:   Math.round(cur.apparent_temperature),
    humidity:    cur.relative_humidity_2m as number,
    windKph:     Math.round(cur.wind_speed_10m),
    weatherCode: cur.weather_code as number,
    isDay:       cur.is_day === 1,
    tempMax:     Math.round((daily.temperature_2m_max as number[])[0]),
    tempMin:     Math.round((daily.temperature_2m_min as number[])[0]),
    forecast:    (daily.time as string[]).slice(1).map((date, i) => ({
      date,
      tempMax:     Math.round((daily.temperature_2m_max as number[])[i + 1]),
      tempMin:     Math.round((daily.temperature_2m_min as number[])[i + 1]),
      weatherCode: (daily.weather_code as number[])[i + 1],
      precipMm:    Math.round(((daily.precipitation_sum as number[])[i + 1] ?? 0) * 10) / 10,
    })),
    fetchedAt: Date.now(),
  }
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(loadCache)
  const [status,  setStatus]  = useState<WeatherStatus>(() => loadCache() ? 'success' : 'idle')
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback((force = false) => {
    if (!force) {
      const cached = loadCache()
      if (cached) { setWeather(cached); setStatus('success'); return }
    }
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị'); setStatus('error'); return
    }
    setStatus('locating'); setError(null)
    getPosition()
      .then(pos => {
        setStatus('loading')
        return fetchWeatherData(pos.coords.latitude, pos.coords.longitude)
      })
      .then(data => {
        saveCache(data); setWeather(data); setStatus('success')
      })
      .catch((err: GeolocationPositionError | Error) => {
        const msg = 'code' in err && err.code === 1
          ? 'Vui lòng cho phép quyền truy cập vị trí'
          : 'Không thể tải dữ liệu thời tiết'
        setError(msg); setStatus('error')
      })
  }, [])

  useEffect(() => { if (status === 'idle') load() }, [load, status])

  return { weather, status, error, refresh: () => load(true) }
}
