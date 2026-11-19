// 過去問サイト（Archive）の問題一覧の絞り込みと並び替え
import type { ArchiveDifficulty, ArchiveFieldId, ArchiveQuestionStatus, ArchiveQuestionSummary } from "@/lib/services/gas-contract"
import { ARCHIVE_FIELDS } from "@/lib/archive"

export type ArchiveSort =
  | "id-asc"
  | "id-desc"
  | "posted-desc"
  | "posted-asc"
  | "field-asc"
  | "field-desc"
  | "accuracy-asc"
  | "accuracy-desc"
  | "status-asc"
  | "status-desc"
  | "answers-desc"
  | "reports-desc"
  | "reports-asc"

/** 表の見出しで並び替えられる列 */
export type ArchiveSortColumn = "id" | "posted" | "field" | "accuracy" | "status" | "reports"
/** 列 → [初めて押したときの向き, もう一度押したときの向き] */
export const ARCHIVE_COLUMN_SORTS: Record<ArchiveSortColumn, [ArchiveSort, ArchiveSort]> = {
  id: ["id-asc", "id-desc"],
  posted: ["posted-desc", "posted-asc"],
  field: ["field-asc", "field-desc"],
  accuracy: ["accuracy-asc", "accuracy-desc"],
  status: ["status-asc", "status-desc"],
  reports: ["reports-desc", "reports-asc"],
}

/** 見出しを押したときの次の並び：今の列なら向きを入れ替え、別の列ならその列の最初の向き */
export function nextColumnSort(current: ArchiveSort, column: ArchiveSortColumn): ArchiveSort {
  const [first, second] = ARCHIVE_COLUMN_SORTS[column]
  return current === first ? second : first
}

/** 今の並びがその列なら向き（昇順・降順）、違えば null */
export function columnDirection(current: ArchiveSort, column: ArchiveSortColumn): "ascending" | "descending" | null {
  if (!ARCHIVE_COLUMN_SORTS[column].includes(current)) return null
  return current.endsWith("-asc") ? "ascending" : "descending"
}

export const ARCHIVE_SORT_LABEL: Record<ArchiveSort, string> = {
  "id-asc": "問題ID（小さい順）",
  "id-desc": "問題ID（大きい順）",
  "posted-desc": "出題日（新しい順）",
  "posted-asc": "出題日（古い順）",
  "field-asc": "分野（天文から）",
  "field-desc": "分野（宇宙政策から）",
  "accuracy-asc": "正答率（低い順）",
  "accuracy-desc": "正答率（高い順）",
  "status-asc": "状態（公開が先）",
  "status-desc": "状態（停止が先）",
  "answers-desc": "サイトの回答数（多い順）",
  "reports-desc": "未対応の誤り報告（多い順）",
  "reports-asc": "未対応の誤り報告（少ない順）",
}

export const ARCHIVE_PLATFORM_LABEL: Record<string, string> = { x: "X", discord: "Discord", instagram: "Instagram", mycommu: "マイコミュ" }
export const ARCHIVE_PLATFORMS = Object.keys(ARCHIVE_PLATFORM_LABEL)

/** 要確認：問題文がない・選択肢が2つしかない・正解が入っていない */
export type ArchiveIssue = "noText" | "twoChoices" | "noCorrect"
export const ARCHIVE_ISSUE_LABEL: Record<ArchiveIssue, string> = { noText: "問題文がない", twoChoices: "選択肢が2つしかない", noCorrect: "正解が入っていない" }

export interface ArchiveFilter {
  query: string
  sort: ArchiveSort
  /** 空はすべて */
  fields: ArchiveFieldId[]
  status: ArchiveQuestionStatus | "all"
  difficulties: ArchiveDifficulty[]
  /** yyyy-mm-dd。空は指定なし */
  postedFrom: string
  postedTo: string
  /** 0〜100（%）。空は指定なし */
  accuracyMin: string
  accuracyMax: string
  /** 正答率の範囲を指定したとき、未集計の問題も含めるか */
  includeUnrated: boolean
  platforms: string[]
  issues: ArchiveIssue[]
  reportedOnly: boolean
  revisedOnly: boolean
}

export const DEFAULT_ARCHIVE_FILTER: ArchiveFilter = {
  query: "",
  sort: "id-asc",
  fields: [],
  status: "all",
  difficulties: [],
  postedFrom: "",
  postedTo: "",
  accuracyMin: "",
  accuracyMax: "",
  includeUnrated: false,
  platforms: [],
  issues: [],
  reportedOnly: false,
  revisedOnly: false,
}

export function issuesOf(q: ArchiveQuestionSummary): ArchiveIssue[] {
  const out: ArchiveIssue[] = []
  if (!q.text.trim()) out.push("noText")
  if (q.choices.filter((c) => c.text.trim()).length < 3) out.push("twoChoices")
  if (!q.correct || !q.choices.some((c) => c.id === q.correct && c.text.trim())) out.push("noCorrect")
  return out
}

/** 「詳しい条件」に入っている条件の数（ボタンに出す） */
export function advancedCount(f: ArchiveFilter) {
  return [
    f.difficulties.length > 0,
    f.postedFrom || f.postedTo,
    f.accuracyMin !== "" || f.accuracyMax !== "",
    f.platforms.length > 0,
    f.issues.length > 0,
    f.reportedOnly,
    f.revisedOnly,
  ].filter(Boolean).length
}

export function isDefaultFilter(f: ArchiveFilter) {
  return JSON.stringify(f) === JSON.stringify(DEFAULT_ARCHIVE_FILTER)
}

const pct = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s) / 100)

export function filterArchiveQuestions(list: ArchiveQuestionSummary[], f: ArchiveFilter): ArchiveQuestionSummary[] {
  const q = f.query.trim().toLowerCase()
  const min = pct(f.accuracyMin)
  const max = pct(f.accuracyMax)
  const out = list.filter((x) => {
    if (f.fields.length && !f.fields.includes(x.fieldId)) return false
    if (f.status !== "all" && x.status !== f.status) return false
    if (f.difficulties.length && !f.difficulties.includes(x.difficulty)) return false
    if (f.postedFrom && (!x.postedOn || x.postedOn < f.postedFrom)) return false
    if (f.postedTo && (!x.postedOn || x.postedOn > f.postedTo)) return false
    if (min !== null || max !== null) {
      if (x.displayAccuracy === null) {
        if (!f.includeUnrated) return false
      } else {
        if (min !== null && x.displayAccuracy < min) return false
        if (max !== null && x.displayAccuracy > max) return false
      }
    }
    if (f.platforms.length && !x.platforms.some((p) => f.platforms.includes(p))) return false
    if (f.issues.length) {
      const has = issuesOf(x)
      if (!f.issues.some((i) => has.includes(i))) return false
    }
    if (f.reportedOnly && x.openReports === 0) return false
    if (f.revisedOnly && x.versionNo < 2) return false
    if (!q) return true
    return x.id.toLowerCase().includes(q) || x.text.toLowerCase().includes(q) || x.choices.some((c) => c.text.toLowerCase().includes(q))
  })
  return sortArchiveQuestions(out, f.sort)
}

export function sortArchiveQuestions(list: ArchiveQuestionSummary[], sort: ArchiveSort): ArchiveQuestionSummary[] {
  const byId = (a: ArchiveQuestionSummary, b: ArchiveQuestionSummary) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const fieldRank = (x: ArchiveQuestionSummary) => {
    const i = ARCHIVE_FIELDS.indexOf(x.fieldId)
    return i < 0 ? ARCHIVE_FIELDS.length : i
  }
  const statusRank = (x: ArchiveQuestionSummary) => (x.status === "published" ? 0 : 1)
  // 正答率で並べるとき、未集計は向きにかかわらず最後
  const byAccuracy = (dir: 1 | -1) => (a: ArchiveQuestionSummary, b: ArchiveQuestionSummary) => {
    if (a.displayAccuracy === null && b.displayAccuracy === null) return byId(a, b)
    if (a.displayAccuracy === null) return 1
    if (b.displayAccuracy === null) return -1
    return (a.displayAccuracy - b.displayAccuracy) * dir || byId(a, b)
  }
  const cmp: Record<ArchiveSort, (a: ArchiveQuestionSummary, b: ArchiveQuestionSummary) => number> = {
    "id-asc": byId,
    "id-desc": (a, b) => byId(b, a),
    "posted-desc": (a, b) => (b.postedOn || "").localeCompare(a.postedOn || "") || byId(a, b),
    "posted-asc": (a, b) => (a.postedOn || "9999").localeCompare(b.postedOn || "9999") || byId(a, b),
    "field-asc": (a, b) => fieldRank(a) - fieldRank(b) || byId(a, b),
    "field-desc": (a, b) => fieldRank(b) - fieldRank(a) || byId(a, b),
    "status-asc": (a, b) => statusRank(a) - statusRank(b) || byId(a, b),
    "status-desc": (a, b) => statusRank(b) - statusRank(a) || byId(a, b),
    "reports-asc": (a, b) => a.openReports - b.openReports || byId(a, b),
    "accuracy-asc": byAccuracy(1),
    "accuracy-desc": byAccuracy(-1),
    "answers-desc": (a, b) => b.basicAnswers - a.basicAnswers || byId(a, b),
    "reports-desc": (a, b) => b.openReports - a.openReports || byId(a, b),
  }
  return [...list].sort(cmp[sort])
}
