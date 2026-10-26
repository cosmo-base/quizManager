import { addMonths } from "@/lib/format"
import { DIFFICULTY_LABEL, FACTCHECK_STATUS, PLATFORM_LABEL, QUESTION_STATUS } from "@/lib/constants"
import { latestJobFor } from "@/lib/validation"
import type {
  Difficulty,
  FactCheckStatus,
  Platform,
  PostJob,
  PostStatus,
  Question,
  QuestionStatus,
  SystemSettings,
} from "@/lib/types"

export function responseStats(q: Question) {
  let responses = 0
  let correct = 0
  let has = false
  for (const s of q.responses) {
    if (s.responses != null) {
      responses += s.responses
      has = true
    }
    if (s.correct != null) correct += s.correct
  }
  return {
    responses: has ? responses : null,
    correct: has ? correct : null,
    rate: has && responses > 0 ? correct / responses : null,
  }
}

const POSTED_LIKE: QuestionStatus[] = ["posted", "scheduled", "archived"]

export function reusableDate(q: Question, rules: SystemSettings["rules"]) {
  if (!q.plannedDate || !POSTED_LIKE.includes(q.status)) return null
  return addMonths(q.plannedDate, rules.sameplatformMonths)
}

export type RateBucket = "all" | "low" | "mid" | "high" | "none"
export type ReuseFilter = "all" | "ok" | "blocked"

export interface LibraryFilters {
  keyword: string
  idQuery: string
  topic: string
  categoryId: string
  platform: "all" | Platform
  difficulty: "all" | Exclude<Difficulty, "auto">
  status: "all" | QuestionStatus
  from: string
  to: string
  minResponses: string
  rate: RateBucket
  factCheck: "all" | FactCheckStatus
  postStatus: "all" | "none" | PostStatus
  reuse: ReuseFilter
}

export const EMPTY_FILTERS: LibraryFilters = {
  keyword: "",
  idQuery: "",
  topic: "",
  categoryId: "all",
  platform: "all",
  difficulty: "all",
  status: "all",
  from: "",
  to: "",
  minResponses: "",
  rate: "all",
  factCheck: "all",
  postStatus: "all",
  reuse: "all",
}

export function activeFilterCount(f: LibraryFilters) {
  return (Object.keys(f) as (keyof LibraryFilters)[]).filter((k) => f[k] !== EMPTY_FILTERS[k]).length
}

export function filterQuestions(
  questions: Question[],
  f: LibraryFilters,
  ctx: { postJobs: PostJob[]; rules: SystemSettings["rules"]; today: string },
) {
  const kw = f.keyword.trim().toLowerCase()
  const idq = f.idQuery.trim().toLowerCase()
  const topic = f.topic.trim().toLowerCase()
  const minResponses = f.minResponses ? Number(f.minResponses) : null

  return questions.filter((q) => {
    if (kw && !`${q.text} ${q.explanation} ${q.choices.map((c) => c.text).join(" ")}`.toLowerCase().includes(kw)) return false
    if (idq && !q.id.toLowerCase().includes(idq) && !q.knowledgeId.toLowerCase().includes(idq)) return false
    if (topic && !q.topic.toLowerCase().includes(topic)) return false
    if (f.categoryId !== "all" && q.categoryId !== f.categoryId) return false
    if (f.platform !== "all" && q.platform !== f.platform) return false
    if (f.difficulty !== "all" && q.difficulty !== f.difficulty) return false
    if (f.status !== "all" && q.status !== f.status) return false
    if (f.from && (!q.plannedDate || q.plannedDate < f.from)) return false
    if (f.to && (!q.plannedDate || q.plannedDate > f.to)) return false
    if (f.factCheck !== "all" && q.factCheck.status !== f.factCheck) return false

    const stats = responseStats(q)
    if (minResponses != null && (stats.responses ?? 0) < minResponses) return false
    if (f.rate !== "all") {
      if (f.rate === "none") {
        if (stats.rate != null) return false
      } else {
        if (stats.rate == null) return false
        if (f.rate === "low" && stats.rate >= 0.3) return false
        if (f.rate === "mid" && (stats.rate < 0.3 || stats.rate > 0.7)) return false
        if (f.rate === "high" && stats.rate <= 0.7) return false
      }
    }

    if (f.postStatus !== "all") {
      const job = latestJobFor(q.id, ctx.postJobs)
      if (f.postStatus === "none" ? !!job : job?.status !== f.postStatus) return false
    }

    if (f.reuse !== "all") {
      const from = reusableDate(q, ctx.rules)
      const reusable = from != null && from <= ctx.today
      if (f.reuse === "ok" && !reusable) return false
      if (f.reuse === "blocked" && (from == null || reusable)) return false
    }
    return true
  })
}

export type SortKey = "id" | "date" | "responses" | "rate" | "updatedAt"

export function sortQuestions(questions: Question[], key: SortKey, dir: "asc" | "desc") {
  const val = (q: Question): string | number => {
    switch (key) {
      case "id":
        return q.id
      case "date":
        return q.plannedDate ?? ""
      case "responses":
        return responseStats(q).responses ?? -1
      case "rate":
        return responseStats(q).rate ?? -1
      case "updatedAt":
        return q.updatedAt
    }
  }
  const sign = dir === "asc" ? 1 : -1
  return [...questions].sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    return (va < vb ? -1 : va > vb ? 1 : 0) * sign
  })
}

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function questionsToCsv(questions: Question[], categoryName: (id: string) => string) {
  const header = [
    "問題ID", "知識ID", "題材", "問題文", "選択肢A", "選択肢B", "選択肢C", "正解", "解説",
    "媒体", "分類", "難易度", "出題日", "問題状態", "検証状態", "回答数", "正答数",
  ]
  const rows = questions.map((q) => {
    const s = responseStats(q)
    const choice = (l: string) => q.choices.find((c) => c.label === l)?.text ?? ""
    return [
      q.id, q.knowledgeId, q.topic, q.text, choice("A"), choice("B"), choice("C"), q.answer, q.explanation,
      PLATFORM_LABEL[q.platform], categoryName(q.categoryId), DIFFICULTY_LABEL[q.difficulty], q.plannedDate,
      QUESTION_STATUS[q.status].label, FACTCHECK_STATUS[q.factCheck.status].label, s.responses, s.correct,
    ]
  })
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
