import type { AIInsight, FactCheck, Integration, PostJob, Question, ResponseSnapshot } from "@/lib/types"
import type { Role } from "@/lib/types"
import type { GasAutomationStatus, GasMe, GasPostJob, GasQuestion, GasRoleRequest, GasStatus, GasUser, GenerateQuestionsInput, GenerateQuestionsResult, SaveQuestionInput } from "./gas-contract"

export interface InsightRequest {
  scope: AIInsight["scope"]
  targetLabel: string
  questionIds: string[]
  model: string
}

/**
 * Backend contract used by the UI.
 * - demo: lib/services/mock-adapter.ts（擬似処理。外部へは一切送信しない）
 * - live: lib/services/live-adapter.ts（GAS Web アプリ）
 */
export interface QuizBackend {
  readonly mode: "demo" | "live"
  /** 事実確認・正解一意性・出典照合などを再実行 */
  verifyQuestion(question: Question): Promise<FactCheck>
  /** X / Discord へ投稿。Instagram は休止中のため呼ばない */
  publishPost(job: PostJob, question: Question): Promise<{ externalId: string; url: string; publishedAt: string; dryRun?: boolean; warning?: string | null }>
  /** 公開状況が不明な投稿を照会。見つからない場合 found=false */
  checkPostStatus(job: PostJob): Promise<{ found: boolean; url: string | null; externalId: string | null }>
  revealAnswer(job: PostJob, question: Question): Promise<void>
  fetchResponses(job: PostJob, question: Question): Promise<ResponseSnapshot>
  syncToSheets(jobs: PostJob[]): Promise<{ rows: number }>
  runInsight(req: InsightRequest): Promise<Pick<AIInsight, "facts" | "hypotheses" | "improvements" | "verification" | "cautions">>
  testConnection(key: Integration["key"]): Promise<Integration["status"]>
  // 以下は実APIモードのみ（正本の Sheets から読み書きする）
  getStatus(): Promise<GasStatus>
  listQuestions(): Promise<GasQuestion[]>
  saveQuestion(input: SaveQuestionInput): Promise<GasQuestion>
  listPostJobs(): Promise<GasPostJob[]>
  getAutomationStatus(): Promise<GasAutomationStatus>
  setAutomationEnabled(enabled: boolean): Promise<{ enabled: boolean }>
  /** Gemini で問題を作り、下書きで正本に保存する */
  generateQuestions(input: GenerateQuestionsInput): Promise<GenerateQuestionsResult>
  /** ログインした人と、その権限 */
  getMe(): Promise<GasMe>
  requestRole(role: Role, note: string): Promise<{ pendingRequest: GasRoleRequest }>
  /** 以下は管理者のみ */
  listUsers(): Promise<GasUser[]>
  setUserRole(email: string, role: Role): Promise<{ email: string; role: Role }>
  rejectRoleRequest(email: string): Promise<{ email: string }>
}

export class NotConnectedError extends Error {
  constructor(public readonly operation: string, public readonly hint: string) {
    super(`${operation}：実APIが未接続です`)
    this.name = "NotConnectedError"
  }
}
