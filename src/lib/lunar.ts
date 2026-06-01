// Vietnamese Lunar Calendar engine
// Conversion algorithm by Hồ Ngọc Đức (Ho Ngoc Duc)
// https://www.informatik.uni-leipzig.de/~duc/amlich/

const CAN  = ['Giáp','Ất','Bính','Đinh','Mậu','Kỷ','Canh','Tân','Nhâm','Quý']
const CHI  = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi']

// 12 thần (spirits) and their auspiciousness
const THAN_NAMES = [
  'Thanh Long','Minh Đường','Thiên Hình','Chu Tước',
  'Kim Quỹ','Thiên Đức','Bạch Hổ','Ngọc Đường',
  'Thiên Lao','Huyền Vũ','Tư Mệnh','Câu Trận',
]
const IS_HOANG_DAO = [true,true,false,false,true,true,false,true,false,false,true,false]

const THAN_NEN: string[][] = [
  ['Khai trương','Ký hợp đồng','Xuất hành','Cưới hỏi','Cầu tài lộc'],
  ['Khai trương','Xây dựng','Cầu tài','Ký kết'],
  ['Kiện tụng','Tố tụng pháp lý'],
  ['Tố tụng','Tranh luận pháp lý'],
  ['Cưới hỏi','Xây dựng','Khai trương','Ký kết'],
  ['Mọi việc đều thuận lợi','Cúng bái','Khai trương','Cưới hỏi'],
  ['Phá giải','Tố tụng'],
  ['Cưới hỏi','Khai trương','Cầu tài','Ký kết'],
  ['Tố tụng pháp lý'],
  [],
  ['Cúng bái','Tu dưỡng','Cầu an'],
  ['Kiện tụng'],
]
const THAN_KY: string[][] = [
  [],
  [],
  ['Khai trương','Cưới hỏi','Xuất hành','Ký kết'],
  ['Khai trương','Cưới hỏi','Ký kết'],
  [],
  [],
  ['Cưới hỏi','Khai trương','Xuất hành'],
  [],
  ['Khai trương','Cưới hỏi','Ký kết'],
  ['Khai trương','Cưới hỏi','Xuất hành','Ký kết'],
  ['Khai trương'],
  ['Khai trương','Cưới hỏi'],
]

// 24 tiết khí — indexed by sun longitude sector (0° = Xuân Phân, each sector = 15°)
const TIET_KHI: string[] = [
  'Xuân Phân','Thanh Minh','Cốc Vũ','Lập Hạ',
  'Tiểu Mãn','Mang Chủng','Hạ Chí','Tiểu Thử',
  'Đại Thử','Lập Thu','Xử Thử','Bạch Lộ',
  'Thu Phân','Hàn Lộ','Sương Giáng','Lập Đông',
  'Tiểu Tuyết','Đại Tuyết','Đông Chí','Tiểu Hàn',
  'Đại Hàn','Lập Xuân','Vũ Thủy','Kinh Trập',
]

// ── Calendar math ────────────────────────────────────────────────────────────

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = Math.floor((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045
  if (jd < 2299161) {
    jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083
  }
  return jd
}

function sunLongitudeDeg(jd: number): number {
  const T  = (jd - 2451545.0) / 36525
  const T2 = T * T
  const dr = Math.PI / 180
  const M  = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2
  let DL   = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL      += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M)
  DL      += 0.000290 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L - 360 * Math.floor(L / 360)
  return L
}

function getNewMoonDay(k: number, tz: number): number {
  const T  = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = Math.PI / 180
  let Jd1  = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1     += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M   = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F   = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (M + 2 * Mpr))
  let deltat: number
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  return Math.floor(Jd1 + C1 - deltat + 0.5 + tz / 24)
}

function sunSector(jd: number, tz: number): number {
  return Math.floor(sunLongitudeDeg(jd - 0.5 - tz / 24) / 30)
}

function getLunarMonth11(yy: number, tz: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k   = Math.floor(off / 29.530588853)
  let nm    = getNewMoonDay(k, tz)
  if (sunSector(nm, tz) >= 9) nm = getNewMoonDay(k - 1, tz)
  return nm
}

function getLeapMonthOffset(a11: number, tz: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let i = 1, last = 0
  let arc = sunSector(getNewMoonDay(k + i, tz), tz)
  do { last = arc; i++; arc = sunSector(getNewMoonDay(k + i, tz), tz) } while (arc !== last && i < 14)
  return i - 1
}

function solarToLunar(d: number, m: number, y: number): [number, number, number, boolean] {
  const TZ = 7
  const jd  = jdFromDate(d, m, y)
  const k   = Math.floor((jd - 2415021.076998695) / 29.530588853)
  let ms    = getNewMoonDay(k + 1, TZ)
  if (ms > jd) ms = getNewMoonDay(k, TZ)
  let a11   = getLunarMonth11(y, TZ)
  let b11   = a11
  if (a11 >= ms) b11 = getLunarMonth11(y - 1, TZ)
  const lDay  = jd - ms + 1
  const diff  = Math.floor((ms - b11) / 29)
  let lMonth  = diff + 11
  let lLeap   = false
  if (b11 < a11) {
    const lo = getLeapMonthOffset(b11, TZ)
    if (diff >= lo) { lMonth = diff + 10; if (diff === lo) lLeap = true }
  }
  if (lMonth > 12) lMonth -= 12
  let lYear = y
  if (lMonth >= 11 && diff < 4) lYear--
  return [lDay, lMonth, lYear, lLeap]
}

// ── Can Chi ──────────────────────────────────────────────────────────────────

function canChiYear(lunarYear: number): string {
  const can = ((lunarYear - 4) % 10 + 10) % 10
  const chi = ((lunarYear - 4) % 12 + 12) % 12
  return `${CAN[can]} ${CHI[chi]}`
}

function canChiMonth(lunarMonth: number, lunarYear: number): string {
  const yearCan  = ((lunarYear - 4) % 10 + 10) % 10
  const startCan = [2, 4, 6, 8, 0][yearCan % 5]
  const can      = (startCan + lunarMonth - 1) % 10
  const chi      = (lunarMonth + 1) % 12   // month 1→Dần(2), month 12→Sửu(1)
  return `${CAN[can]} ${CHI[chi]}`
}

function canChiDay(jd: number): string {
  const can = ((jd + 9) % 10 + 10) % 10
  const chi = ((jd + 1) % 12 + 12) % 12
  return `${CAN[can]} ${CHI[chi]}`
}

// ── Hoàng Đạo / Hắc Đạo ─────────────────────────────────────────────────────

// For month m, starting thần index = ((m-1) % 6) * 2
// Day d in that month → thanIdx = (startIdx + d - 1) % 12
function getThan(lunarMonth: number, lunarDay: number): { name: string; isHoangDao: boolean; nen: string[]; ky: string[] } {
  const startIdx = ((lunarMonth - 1) % 6) * 2
  const idx      = (startIdx + lunarDay - 1) % 12
  return { name: THAN_NAMES[idx], isHoangDao: IS_HOANG_DAO[idx], nen: THAN_NEN[idx], ky: THAN_KY[idx] }
}

// ── Tiết khí ─────────────────────────────────────────────────────────────────

function detectTietKhi(date: Date): string | undefined {
  const jd      = jdFromDate(date.getDate(), date.getMonth() + 1, date.getFullYear())
  const sl      = sunLongitudeDeg(jd - 0.5 - 7 / 24)
  const slPrev  = sunLongitudeDeg(jd - 1.5 - 7 / 24)
  const sector  = Math.floor(sl / 15)
  const prevSec = Math.floor(slPrev / 15)
  if (sector === prevSec) return undefined
  return TIET_KHI[sector % 24]
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface LunarInfo {
  day: number
  month: number
  year: number
  leap: boolean
  canChiDay: string
  canChiMonth: string
  canChiYear: string
  than: string
  isHoangDao: boolean
  nen: string[]
  ky: string[]
  tietKhi?: string
}

// Memoize results by Y-M-D — the conversion is heavy (trig-based astronomy)
// and the calendar grid re-queries the same dates whenever months are revisited.
const lunarCache = new Map<string, LunarInfo>()

export function getLunarInfo(date: Date): LunarInfo {
  const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear()
  const key = `${y}-${m}-${d}`
  const cached = lunarCache.get(key)
  if (cached) return cached
  const info = computeLunarInfo(d, m, y, date)
  lunarCache.set(key, info)
  return info
}

function computeLunarInfo(d: number, m: number, y: number, date: Date): LunarInfo {
  const [lDay, lMonth, lYear, lLeap] = solarToLunar(d, m, y)
  const jd   = jdFromDate(d, m, y)
  const than = getThan(lMonth, lDay)
  return {
    day:        lDay,
    month:      lMonth,
    year:       lYear,
    leap:       lLeap,
    canChiDay:  canChiDay(jd),
    canChiMonth: canChiMonth(lMonth, lYear),
    canChiYear: canChiYear(lYear),
    than:       than.name,
    isHoangDao: than.isHoangDao,
    nen:        than.nen,
    ky:         than.ky,
    tietKhi:    detectTietKhi(date),
  }
}
