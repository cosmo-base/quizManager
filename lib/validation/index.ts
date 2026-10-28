import type { Platform, PostJob, Question, Role, SystemSettings } from "@/lib/types"
import { addMonths } from "@/lib/format"
import { PLATFORM_LABEL, PLATFORM_TEXT_LIMIT } from "@/lib/constants"
import { overlongXChoices } from "@/lib/x-poll"
import { overlongDiscordText } from "@/lib/discord-format"

export interface ReuseConflict {
  questionId: string
  platform: Platform
  date: string
  reusableFrom: string
  samePlatform: boolean
}

/**
 * 再出題制限（同一媒体: N暦月 / 異なる媒体: M暦月）を、出題済み・予約済みを含めて判定する。
 * 判定単位は問題文ではなく knowledgeId（問う知識）。
 */
export function checkReuse(
  question: Pick<Question, "id" | "knowledgeId">,
  platform: Platform,
  date: string,
  questions: Question[],
  rules: SystemSettings["rules"],
): { ok: boolean; conflicts: ReuseConflict[]; reusableFrom: string | null } {
  const conflicts: ReuseConflict[] = []
  for (const other of questions) {
    if (other.id === question.id || other.knowledgeId !== question.knowledgeId) continue
    if (!other.plannedDate) continue
    if (!["scheduled", "posted", "archived", "approved"].includes(other.status)) continue
    const samePlatform = other.platform === platform
    const months = samePlatform ? rules.sameplatformMonths : rules.crossPlatformMonths
    const reusableFrom = addMonths(other.plannedDate, months)
    const windowEndsBefore = addMonths(date, months)
    if (date < reusableFrom && other.plannedDate < windowEndsBefore) {
      conflicts.push({ questionId: other.id, platform: other.platform, date: other.plannedDate, reusableFrom, samePlatform })
    }
  }
  const reusableFrom = conflicts.length ? conflicts.map((c) => c.reusableFrom).sort().at(-1)! : null
  return { ok: conflicts.length === 0, conflicts, reusableFrom }
}

export function describeConflict(c: ReuseConflict) {
  return `${c.questionId}（${PLATFORM_LABEL[c.platform]}・${c.date}）と同一知識。${c.samePlatform ? "同一媒体" : "異なる媒体"}の再出題可能日は ${c.reusableFrom}`
}

export function validateQuestionDraft(draft: { text: string; choices: { text: string }[]; explanation: string }, platform: Platform) {
  const errors: string[] = []
  const limit = PLATFORM_TEXT_LIMIT[platform]
  if (!draft.text.trim()) errors.push("問題文を入力してください")
  if (draft.text.length > limit.question) errors.push(`問題文が${PLATFORM_LABEL[platform]}の上限（${limit.question}字）を超えています`)
  draft.choices.forEach((c, i) => {
    if (!c.text.trim()) errors.push(`選択肢${"ABC"[i]}を入力してください`)
    if (c.text.length > limit.choice) errors.push(`選択肢${"ABC"[i]}が上限（${limit.choice}字）を超えています`)
  })
  const texts = draft.choices.map((c) => c.text.trim())
  if (new Set(texts).size !== texts.length) errors.push("選択肢が重複しています")
  if (!draft.explanation.trim()) errors.push("解説を入力してください")
  return errors
}

/** 投稿予約が可能か（未検証・重複疑義・旧版画像の問題は投稿しない） */
export function canSchedule(q: Question): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (!["approved"].includes(q.status)) reasons.push("確定（承認済み）ではありません")
  if (q.factCheck.status === "pending" || q.factCheck.status === "running") reasons.push("検証が完了していません")
  if (q.factCheck.status === "failed") reasons.push("検証NGです")
  if (q.duplicate.level === "strong") reasons.push("強い重複疑義があります")
  if (q.imageStatus !== "ready") reasons.push("画像が確定版と一致していません")
  if (q.platform === "instagram") reasons.push("Instagramは投稿休止中です")
  if (!q.plannedDate) reasons.push("出題日が未設定です")
  return { ok: reasons.length === 0, reasons }
}

/**
 * 実APIモードで、承認済みの問題が投稿の予約一覧に並ばない理由。
 * 実APIモードは画像なし・事実確認は未接続のため、それらは条件にしない。
 */
export function liveScheduleIssues(q: Question, jobs: PostJob[], discordConfigured = false): string[] {
  const reasons: string[] = []
  if (q.status !== "approved") reasons.push("承認済みではありません")
  if (q.platform === "instagram") reasons.push("Instagram の投稿は休止中です")
  if (q.platform === "discord" && !discordConfigured) reasons.push("Discord の Bot が未設定です（GAS の DISCORD_BOT_TOKEN・DISCORD_QUIZ_CHANNEL_ID）")
  if (!q.plannedDate) reasons.push("出題日が未設定です（問題を編集して出題日を入れると予約に並びます）")
  else {
    const other = jobs.find((j) => j.id === `${q.plannedDate}:${q.platform}` && j.questionId !== q.id)
    if (other) reasons.push(`この日はすでに ${other.questionId} の投稿があります（出題日を変えてください）`)
  }
  const tooLong = overlongXChoices(q)
  if (q.platform === "x" && tooLong.length) reasons.push(`選択肢 ${tooLong.join("・")} が投票の上限（番号込み 25 文字）を超えています`)
  const discordLen = q.platform === "discord" ? overlongDiscordText(q) : null
  if (discordLen !== null) reasons.push(`メッセージが ${discordLen} 文字あり、Discord の上限（2000 文字）を超えています`)
  return reasons
}

export type Permission =
  | "generate"
  | "edit"
  | "approve"
  | "plan"
  | "post"
  | "settings"
  | "users"
  | "automation"
  | "analyze"

const MATRIX: Record<Role, Permission[]> = {
  admin: ["generate", "edit", "approve", "plan", "post", "settings", "users", "automation", "analyze"],
  editor: ["generate", "edit", "plan", "analyze"],
  approver: ["approve", "post", "analyze"],
  viewer: [],
}

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission)
}

export function latestJobFor(questionId: string, jobs: PostJob[]) {
  return jobs.filter((j) => j.questionId === questionId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
}
