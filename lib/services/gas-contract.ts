// GAS Web アプリとの通信契約（決定事項：ロジックは GAS、データの正本は Google Sheets）。
// 管理画面は Google ログインの ID トークンを付けて POST し、GAS 側で検証・許可メールアドレスと照合する。
// GAS 側の実装：WebApp.gs（振り分け）・Questions.gs・Posting.gs
import type { ChoiceLabel, Choice, Platform, PostStatus, QuestionStatus, ResponseSnapshot } from "@/lib/types"

export type GasAction =
  | "testConnection"
  | "getStatus"
  | "listQuestions"
  | "saveQuestion"
  | "listPostJobs"
  | "publishPost"
  | "revealAnswer"
  | "fetchResponses"
  | "checkPostStatus"
  | "verifyQuestion"
  | "syncToSheets"
  | "runInsight"

export interface GasRequest<P = unknown> {
  action: GasAction
  /** Google ログインの ID トークン（GAS 側で検証） */
  idToken: string
  payload: P
}

export type GasResponse<T> =
  | { ok: true; data: T }
  /** outcome=unknown は成否不明。UI から自動で再実行しないこと */
  | { ok: false; outcome: "failed" | "unknown"; error: string }

/** getStatus：X_DRY_RUN が有効なら X には投稿しない */
export interface GasStatus {
  dryRun: boolean
}

/** questions タブの最新版（保存のたびに版が 1 つ上がる） */
export interface GasQuestion {
  id: string
  version: number
  platform: Platform
  plannedDate: string | null
  status: QuestionStatus
  text: string
  choices: Choice[]
  answer: ChoiceLabel
  explanation: string
  savedBy: string
  savedAt: string | null
  versionCount: number
}

/** saveQuestion：id なしで新規（ID は GAS が採番）、ありで新しい版を追記 */
export interface SaveQuestionInput {
  id?: string
  text: string
  choices: Choice[]
  answer: ChoiceLabel
  explanation: string
  platform: Platform
  plannedDate: string | null
  status: QuestionStatus
  note?: string
}

/** 投稿の対象（冪等キーは「日付:媒体:種別」） */
export interface PostTarget {
  date: string
  platform: Exclude<Platform, "instagram">
}

/** publishPost：X は本文（問題文）＋番号付きの投票（1430 分）。版を固定して投稿する */
export interface PublishPostPayload extends PostTarget {
  questionId: string
  version: number
}
export interface PublishPostResult {
  externalId: string
  url: string
  publishedAt: string
  dryRun: boolean
}

/** listPostJobs：post_log と responses から求めた投稿の状態（日付×媒体ごと） */
export interface GasPostJob {
  id: string
  date: string
  platform: Exclude<Platform, "instagram">
  questionId: string | null
  questionVersion: number | null
  status: Extract<PostStatus, "draft" | "posted" | "failed" | "unknown">
  publishedAt: string | null
  externalId: string | null
  url: string | null
  answerRevealed: boolean
  error: string | null
  dryRun: boolean
  response: Pick<ResponseSnapshot, "responses" | "correct" | "perChoice" | "finalized" | "collectedAt"> | null
}
