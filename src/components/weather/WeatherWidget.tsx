import {
  Sun, Moon, Cloud, CloudSun, CloudFog, CloudDrizzle,
  CloudRain, CloudRainWind, CloudSnow, CloudLightning,
  Wind, Droplets, Thermometer, RefreshCw, MapPin, CloudHail,
} from 'lucide-react'
import { useWeather, type WeatherData, type ForecastDay } from '../../hooks/useWeather'

// ── WMO weather code mapping ────────────────────────────────────────────────

type IconComponent = typeof Sun

interface Condition {
  label: string
  Icon: IconComponent
  color: string
}

function getCondition(code: number, isDay: boolean): Condition {
  if (code === 0)  return { label: isDay ? 'Nắng' : 'Trời quang', Icon: isDay ? Sun : Moon, color: isDay ? '#fbbf24' : '#818cf8' }
  if (code <= 2)   return { label: 'Ít mây', Icon: CloudSun, color: '#f59e0b' }
  if (code === 3)  return { label: 'Nhiều mây', Icon: Cloud, color: '#94a3b8' }
  if (code <= 48)  return { label: 'Sương mù', Icon: CloudFog, color: '#94a3b8' }
  if (code <= 55)  return { label: 'Mưa phùn', Icon: CloudDrizzle, color: '#60a5fa' }
  if (code <= 65)  return { label: 'Có mưa', Icon: CloudRain, color: '#3b82f6' }
  if (code <= 77)  return { label: 'Có tuyết', Icon: CloudSnow, color: '#bfdbfe' }
  if (code <= 82)  return { label: 'Mưa rào', Icon: CloudRainWind, color: '#3b82f6' }
  if (code <= 86)  return { label: 'Tuyết rào', Icon: CloudSnow, color: '#e0f2fe' }
  if (code <= 99)  return { label: 'Có dông', Icon: CloudLightning, color: '#a78bfa' }
  return { label: 'Mưa đá', Icon: CloudHail, color: '#94a3b8' }
}

function getBg(code: number, isDay: boolean): React.CSSProperties {
  if (!isDay)    return { background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }
  if (code === 0) return { background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }
  if (code <= 3)  return { background: 'linear-gradient(135deg, #7dd3fc 0%, #6366f1 100%)' }
  if (code <= 48) return { background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' }
  if (code <= 77) return { background: 'linear-gradient(135deg, #475569 0%, #1e3a5f 100%)' }
  if (code <= 86) return { background: 'linear-gradient(135deg, #93c5fd 0%, #475569 100%)' }
  return { background: 'linear-gradient(135deg, #6b21a8 0%, #1e293b 100%)' }
}

// ── Sub-components ──────────────────────────────────────────────────────────

const DOW_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function ForecastItem({ day }: { day: ForecastDay }) {
  const date = new Date(day.date + 'T12:00:00')
  const dow  = DOW_VI[date.getDay()]
  const { Icon, color } = getCondition(day.weatherCode, true)
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-[11px] text-white/60 font-medium">{dow}</span>
      <Icon size={18} style={{ color }} />
      {day.precipMm > 0 ? (
        <span className="text-[10px] text-blue-200 leading-none">{day.precipMm}mm</span>
      ) : (
        <span className="text-[10px] leading-none opacity-0">—</span>
      )}
      <span className="text-xs font-bold text-white">{day.tempMax}°</span>
      <span className="text-[11px] text-white/50">{day.tempMin}°</span>
    </div>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ label }: { label: string }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)' }}
      className="rounded-2xl p-5 flex items-center gap-3 text-white">
      <RefreshCw size={20} className="animate-spin shrink-0 opacity-80" />
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-white/60 text-xs mt-0.5">Sử dụng Open-Meteo API — không cần đăng nhập</p>
      </div>
    </div>
  )
}

// ── Main card ───────────────────────────────────────────────────────────────

function WeatherCard({ w, onRefresh }: { w: WeatherData; onRefresh: () => void }) {
  const { label, Icon, color } = getCondition(w.weatherCode, w.isDay)
  const bgStyle = getBg(w.weatherCode, w.isDay)
  const mins    = Math.round((Date.now() - w.fetchedAt) / 60000)
  const updated = mins < 1 ? 'vừa xong' : `${mins} phút trước`

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={bgStyle}>
      <div className="p-5 text-white">

        {/* ── Top bar ── */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-1.5 text-white/70 text-xs mb-0.5">
              <MapPin size={11} />
              <span className="font-semibold text-white/90">{w.location}</span>
            </div>
            <p className="text-white/50 text-[10px]">Cập nhật {updated}</p>
          </div>
          <button
            onClick={onRefresh}
            title="Làm mới thời tiết"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* ── Current conditions ── */}
        <div className="flex items-end justify-between gap-4">
          {/* Left: big temp */}
          <div>
            <div className="flex items-end gap-3">
              <span className="text-7xl font-bold leading-none tracking-tight">{w.temp}°</span>
              <div className="mb-2">
                <Icon size={36} style={{ color }} />
              </div>
            </div>
            <p className="text-white/90 text-base font-semibold mt-1">{label}</p>
            <p className="text-white/55 text-xs mt-0.5">
              Cảm giác {w.feelsLike}°C · Cao {w.tempMax}° / Thấp {w.tempMin}°
            </p>
          </div>

          {/* Right: detail stats */}
          <div className="shrink-0 space-y-2.5 text-right">
            <div className="flex items-center justify-end gap-1.5 text-white/75 text-sm">
              <span className="font-medium">{w.humidity}%</span>
              <Droplets size={15} className="text-blue-200" />
            </div>
            <div className="flex items-center justify-end gap-1.5 text-white/75 text-sm">
              <span className="font-medium">{w.windKph} km/h</span>
              <Wind size={15} className="text-sky-200" />
            </div>
            <div className="flex items-center justify-end gap-1.5 text-white/75 text-sm">
              <span className="font-medium">↑{w.tempMax}° ↓{w.tempMin}°</span>
              <Thermometer size={15} className="text-orange-200" />
            </div>
          </div>
        </div>

        {/* ── 4-day forecast strip ── */}
        {w.forecast.length > 0 && (
          <>
            <div className="my-4 border-t border-white/15" />
            <div className="flex gap-1">
              {w.forecast.slice(0, 4).map(day => (
                <ForecastItem key={day.date} day={day} />
              ))}
            </div>
          </>
        )}

        {/* ── Indicator row ── */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-4 text-white/40 text-[10px]">
          <span>Nguồn: Open-Meteo</span>
          <span>·</span>
          <span>Vị trí GPS</span>
          <span>·</span>
          <span>Tự động làm mới 30 phút</span>
        </div>
      </div>
    </div>
  )
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function WeatherWidget() {
  const { weather, status, error, refresh } = useWeather()

  if (status === 'idle' || status === 'locating')
    return <Skeleton label="Đang xác định vị trí…" />

  if (status === 'loading')
    return <Skeleton label="Đang tải dữ liệu thời tiết…" />

  if (status === 'error' || (!weather && error)) {
    return (
      <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Không thể tải thời tiết</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{error}</p>
        </div>
        <button
          onClick={refresh}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
        >
          <RefreshCw size={12} /> Thử lại
        </button>
      </div>
    )
  }

  if (!weather) return null
  return <WeatherCard w={weather} onRefresh={refresh} />
}
