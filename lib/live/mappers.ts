// 実APIモード：GAS（正本の Sheets）から読んだデータを、画面で使う型に変換する。
// 正本に無い項目（事実確認・品質スコア・画像など）は「未取得」を表す既定値にする。
import { jstIso } from "@/lib/format"
import type { GasFactCheck, GasPlan, GasPostJob, GasQuestion } from "@/lib/services/gas-contract"
import type { FactCheck, Platform, PostJob, Question, QuestionStatus, ResponseSnapshot, ReviewEntry, Source } from "@/lib/types"

const PENDING_FACT_CHECK: FactCheck = { status: "pending", items: [], concerns: [], checkedAt: null, model: null }

/** ファクトチェック（Gemini）の出典を画面の出典の形にする。中身の階層は分からないので「その他参考情報」 */
function toSources(fc: GasFactCheck | null | undefined): Source[] {
  if (!fc) return []
  return fc.sources.map((s, i) => ({ id: `${fc.version}-${i}`, title: s.title || s.url, publisher: s.title, url: s.url, tier: 4, excerpt: "", checkedAt: fc.checkedAt ?? "" }))
}

const REVIEW_ACTION_BY_STATUS: Partial<Record<QuestionStatus, ReviewEntry["action"]>> = { approved: "approved", returned: "returned", rejected: "rejected" }

export function toQuestion(g: GasQuestion, jobs: PostJob[], responses: ResponseSnapshot[]): Question {
  const snapshot = { text: g.text, choices: g.choices, answer: g.answer, explanation: g.explanation }
  const savedAt = g.savedAt ?? new Date(0).toISOString()
  return {
    id: g.id,
    knowledgeId: g.id,
    topic: g.topic ?? "",
    text: g.text,
    choices: g.choices,
    answer: g.answer,
    explanation: g.explanation,
    // 未設定は分類 ""・難易度 "auto"
    categoryId: g.category ?? "",
    difficulty: g.difficulty ?? "auto",
    platform: g.platform,
    timeliness: "evergreen",
    status: g.status,
    plannedDate: g.plannedDate,
    factCheck: g.factCheck ? { status: g.factCheck.status, items: g.factCheck.items, concerns: g.factCheck.concerns, checkedAt: g.factCheck.checkedAt, model: g.factCheck.model, suggestion: g.factCheck.suggestion ?? null } : { ...PENDING_FACT_CHECK, items: [], concerns: [] },
    duplicate: { level: "none", similar: [], reusableFrom: null },
    quality: { interest: 0, answerability: 0, choiceValidity: 0, learning: 0, platformFit: 0 },
    sources: toSources(g.factCheck),
    // 正本は全版を持つが、画面には最新版だけを渡す（version は実際の版番号）
    versions: [{ version: g.version, hash: "", createdAt: savedAt, author: g.savedBy, summary: `v${g.version}（全 ${g.versionCount} 版）`, snapshot }],
    confirmedVersion: g.status === "approved" || g.status === "scheduled" || g.status === "posted" ? g.version : null,
    history: jobs
      .filter((j) => j.questionId === g.id && j.status !== "scheduled")
      .map((j) => ({ postJobId: j.id, platform: j.platform, publishedAt: j.publishedAt, externalId: j.externalId, url: j.url, status: j.status, version: j.questionVersion })),
    responses: responses.filter((r) => jobs.some((j) => j.id === r.postJobId && j.questionId === g.id)),
    imageStatus: "none",
    imageVersion: null,
    templateId: "",
    autoApprovable: false,
    autoApprovalBlockers: [],
    certification: "none",
    // 最新版のメモ（差し戻し・不採用の理由など）。全版の履歴は問題の画面で getQuestionHistory から読む
    reviewHistory: g.note ? [{ at: savedAt, by: g.savedBy, action: REVIEW_ACTION_BY_STATUS[g.status] ?? "edited", note: g.note }] : [],
    recheckBy: null,
    createdAt: savedAt,
    updatedAt: savedAt,
    generatedBy: null,
    isSample: false,
  }
}

export function toPostJob(g: GasPostJob, defaultTime: string): PostJob {
  return {
    id: g.id,
    questionId: g.questionId ?? "",
    questionVersion: g.questionVersion ?? 0,
    platform: g.platform,
    date: g.date,
    scheduledAt: jstIso(g.date, defaultTime),
    publishedAt: g.publishedAt,
    status: g.status,
    url: g.url,
    externalId: g.externalId,
    responseStatus: g.response ? (g.response.finalized ? "finalized" : "provisional") : g.status === "posted" ? "collecting" : "not_started",
    answerRevealed: g.answerRevealed,
    error: g.error,
    // 正本の Sheets に直接記録しているため、別途の同期は不要
    syncStatus: "synced",
  }
}

export function toResponseSnapshot(g: GasPostJob): ResponseSnapshot | null {
  if (!g.response) return null
  return { platform: g.platform, postJobId: g.id, impressions: null, clicks: null, ...g.response }
}

/**
 * 承認済みで出題日がある X・Discord の問題のうち、まだ投稿記録がないものを「予約済み」の投稿として並べる。
 * 実際の投稿は「今すぐ投稿」（publishPost）で行い、そのとき問題の最新版を固定する。
 */
export interface LivePlan extends GasPlan {
  date: string
  platform: Platform
}

export function scheduledJobsFor(questions: GasQuestion[], jobs: PostJob[], defaultTime: string, platforms: Platform[] = ["x", "discord"], plans: LivePlan[] = []): PostJob[] {
  // 失敗した投稿も一覧に残っているので重ねない（再投稿はその行の「今すぐ投稿」から行う）
  const taken = new Set(jobs.map((j) => j.id))
  // 21:00 に固定した日は、06:00 の自動投稿と同じく固定した版を並べる（出題日が入っているほかの承認済みは並べない）
  const locked: PostJob[] = plans
    .filter((p) => platforms.includes(p.platform) && !taken.has(`${p.date}:${p.platform}`))
    .map((p) => {
      const q = questions.find((x) => x.id === p.questionId)
      const error = !q
        ? `21:00 に固定した問題 ${p.questionId} が見つかりません。06:00 の投稿は止まります`
        : q.status === "rejected" || q.status === "archived"
          ? `21:00 に固定した ${p.questionId} はその後 ${q.status === "rejected" ? "却下" : "アーカイブ"}されたため、06:00 には投稿されません`
          : null
      return {
        ...scheduledJob(`${p.date}:${p.platform}`, p.questionId, p.version, p.platform, p.date, defaultTime),
        error,
        plan: { source: p.source === "spare" ? ("spare" as const) : ("approved" as const), plannedAt: p.plannedAt },
      }
    })
  locked.forEach((j) => taken.add(j.id))
  const seen = new Set<string>()
  const candidates = questions
    .filter((q) => platforms.includes(q.platform) && q.status === "approved" && q.plannedDate)
    .map((q) => ({ q, id: `${q.plannedDate}:${q.platform}` }))
    .filter(({ id }) => {
      // 同じ日・同じ媒体に承認済みが 2 問以上あっても 1 行だけ並べる（どちらを出すかは 21:00 の確定で決まる）
      if (taken.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map(({ q, id }) => scheduledJob(id, q.id, q.version, q.platform, q.plannedDate!, defaultTime))
  return [...locked, ...candidates]
}

function scheduledJob(id: string, questionId: string, version: number, platform: Platform, date: string, defaultTime: string): PostJob {
  return {
    id,
    questionId,
    questionVersion: version,
    platform,
    date,
    scheduledAt: jstIso(date, defaultTime),
    publishedAt: null,
    status: "scheduled",
    url: null,
    externalId: null,
    responseStatus: "not_started",
    answerRevealed: false,
    error: null,
    syncStatus: "synced",
  }
}
