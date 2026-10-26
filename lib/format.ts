// Date helpers. All dates are handled in Japan Standard Time (Asia/Tokyo).
// Date-only values are "YYYY-MM-DD" strings; datetimes are ISO strings with +09:00.

/** デモモードの基準日時。実APIモードでは現在時刻に置き換える。 */
export const DEMO_NOW = "2026-10-25T09:30:00+09:00"
export const DEMO_TODAY = "2026-10-25"

const TZ = "Asia/Tokyo"

function toUtcDate(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

export function addDays(date: string, days: number) {
  const d = toUtcDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonths(date: string, months: number) {
  const d = toUtcDate(date.slice(0, 10))
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function weekday(date: string) {
  return toUtcDate(date).getUTCDay()
}

export function diffDays(a: string, b: string) {
  return Math.round((toUtcDate(a).getTime() - toUtcDate(b).getTime()) / 86400000)
}

export function dateRange(from: string, to: string) {
  const out: string[] = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: string) {
  return addDays(addMonths(startOfMonth(date), 1), -1)
}

export function startOfWeek(date: string) {
  return addDays(date, -weekday(date))
}

const WD = ["日", "月", "火", "水", "木", "金", "土"]

export function formatDate(date: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}) {
  if (!date) return "—"
  const d = date.slice(0, 10)
  const [y, m, day] = d.split("-")
  const base = `${opts.year ? `${y}年` : ""}${Number(m)}月${Number(day)}日`
  return opts.weekday ? `${base}（${WD[weekday(d)]}）` : base
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—"
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  // デモ基準日時より未来・極端に過去のサンプル時刻は絶対表記にする
  if (diffMin < 0 || diffMin > 60 * 24 * 3) return formatDateTime(iso)
  if (diffMin < 1) return "たった今"
  if (diffMin < 60) return `${diffMin}分前`
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}時間前`
  return `${Math.floor(diffMin / 1440)}日前`
}

export function jstIso(date: string, time = "06:00") {
  return `${date}T${time}:00+09:00`
}

/** null（未取得）を 0 と混同しないための表示 */
export function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "未取得"
  return value.toLocaleString("ja-JP")
}

export function formatPercent(num: number | null | undefined, den: number | null | undefined) {
  if (num === null || num === undefined || !den) return "未取得"
  return `${((num / den) * 100).toFixed(1)}%`
}

export function formatYen(value: number | null | undefined) {
  if (value === null || value === undefined) return "未確定"
  return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}`
}

export function shortHash(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 8)
}
