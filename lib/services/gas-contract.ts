// GAS Web アプリとの通信契約（決定事項：ロジックは GAS、データの正本は Google Sheets）。
// 管理画面は Google ログインの ID トークンを付けて POST し、GAS 側で検証・許可メールアドレスと照合する。
// 実際の通信は X API PoC の合格後に live-adapter.ts へ実装する。
import type { ChoiceLabel, Platform, ResponseSnapshot } from "@/lib/types"

export type GasAction =
  | "verifyQuestion"
  | "publishPost"
  | "checkPostStatus"
  | "revealAnswer"
  | "fetchResponses"
  | "syncToSheets"
  | "runInsight"
  | "testConnection"

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

/** publishPost：X は本文＋投票（1/2/3・1430分）。冪等キーは「日付×媒体」 */
export interface PublishPostPayload {
  postJobId: string
  questionId: string
  questionVersion: number
  platform: Exclude<Platform, "instagram">
  date: string
}
export interface PublishPostResult {
  externalId: string
  url: string
  publishedAt: string
}

/** revealAnswer：問題投稿へのリプライとして正解・解説を投稿 */
export interface RevealAnswerPayload {
  postJobId: string
  externalId: string
  answer: ChoiceLabel
}

/** fetchResponses：X は GET /2/tweets/:id の poll（voting_status=closed で確定） */
export interface FetchResponsesPayload {
  postJobId: string
  externalId: string
}
export type FetchResponsesResult = ResponseSnapshot

export interface CheckPostStatusPayload {
  postJobId: string
  platform: Exclude<Platform, "instagram">
  date: string
}
