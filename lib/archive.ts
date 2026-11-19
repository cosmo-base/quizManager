// 過去問サイト（Archive）の表示用の名前と小さな道具
import type { ArchiveChoiceId, ArchiveDifficulty, ArchiveFieldId, ArchiveQuestionStatus, ArchiveReportReason, ArchiveReportStatus } from "@/lib/services/gas-contract"

export const ARCHIVE_SITE_URL = "https://cbquiz.archive.fsif.jp/"

export const ARCHIVE_FIELD_LABEL: Record<ArchiveFieldId, string> = {
  astronomy: "天文",
  development: "宇宙開発",
  business: "宇宙ビジネス",
  exploration: "宇宙探査",
  history: "歴史",
  basics: "宇宙基礎",
  policy: "宇宙政策",
}
export const ARCHIVE_FIELDS = Object.keys(ARCHIVE_FIELD_LABEL) as ArchiveFieldId[]

export const ARCHIVE_STATUS_LABEL: Record<ArchiveQuestionStatus, string> = { published: "公開", stopped: "停止" }

export const ARCHIVE_DIFFICULTY_LABEL: Record<ArchiveDifficulty, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
  expert: "専門家",
  unknown: "不明",
}

export const ARCHIVE_REPORT_STATUS_LABEL: Record<ArchiveReportStatus, string> = { received: "未対応", resolved: "対応済み", dismissed: "対応しない" }
export const ARCHIVE_REPORT_REASON_LABEL: Record<ArchiveReportReason, string> = { answer: "正解", text: "問題文・選択肢", explanation: "解説", other: "その他" }

export const ARCHIVE_CHOICES: ArchiveChoiceId[] = ["A", "B", "C"]

export const archiveQuestionHref = (id: string) => `/archive?tab=questions&id=${encodeURIComponent(id)}`

export function formatAccuracy(v: number | null) {
  return v === null ? "未集計" : `${Math.round(v * 100)}%`
}

/** ISO 日時 → 日本時間の「2026/11/19 14:05」 */
export function formatJst(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** ISO 日時 ↔ <input type="datetime-local"> の値（日本時間） */
export function isoToJstInput(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16)
}
export function jstInputToIso(v: string) {
  if (!v) return ""
  const d = new Date(`${v}:00+09:00`)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "うまくいきませんでした"
}
