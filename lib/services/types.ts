import type { AIInsight, FactCheck, Integration, PostJob, Question, ResponseSnapshot } from "@/lib/types"

export interface InsightRequest {
  scope: AIInsight["scope"]
  targetLabel: string
  questionIds: string[]
  model: string
}

/**
 * Backend contract used by the UI.
 * - demo: lib/services/mock-adapter.ts（擬似処理。外部へは一切送信しない）
 * - live: lib/services/live-adapter.ts（バックエンド担当者が実装する）
 */
export interface QuizBackend {
  readonly mode: "demo" | "live"
  /** 事実確認・正解一意性・出典照合などを再実行 */
  verifyQuestion(question: Question): Promise<FactCheck>
  /** X / Discord へ投稿。Instagram は休止中のため呼ばない */
  publishPost(job: PostJob, question: Question): Promise<{ externalId: string; url: string; publishedAt: string }>
  /** 公開状況が不明な投稿を照会。見つからない場合 found=false */
  checkPostStatus(job: PostJob): Promise<{ found: boolean; url: string | null; externalId: string | null }>
  revealAnswer(job: PostJob, question: Question): Promise<void>
  fetchResponses(job: PostJob, question: Question): Promise<ResponseSnapshot>
  syncToSheets(jobs: PostJob[]): Promise<{ rows: number }>
  runInsight(req: InsightRequest): Promise<Pick<AIInsight, "facts" | "hypotheses" | "improvements" | "verification" | "cautions">>
  testConnection(key: Integration["key"]): Promise<Integration["status"]>
}

export class NotConnectedError extends Error {
  constructor(public readonly operation: string, public readonly hint: string) {
    super(`${operation}：実APIが未接続です`)
    this.name = "NotConnectedError"
  }
}
