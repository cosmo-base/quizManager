// GAS Web アプリとの通信契約（決定事項：ロジックは GAS、データの正本は Google Sheets）。
// 管理画面は Google ログインの ID トークンを付けて POST し、GAS 側で検証・許可メールアドレスと照合する。
// GAS 側の実装：WebApp.gs（振り分け）・Questions.gs・Posting.gs
import type { ChoiceLabel, Choice, FactCheck, Platform, PostStatus, QuestionStatus, ResponseSnapshot, Role } from "@/lib/types"

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
  | "getAutomationStatus"
  | "setAutomationEnabled"
  | "verifyQuestion"
  | "generateQuestions"
  | "listInsights"
  | "getMe"
  | "requestRole"
  | "listUsers"
  | "setUserRole"
  | "rejectRoleRequest"
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
  /** reason=not_allowed は ALLOWED_EMAILS に無いアカウント（ログイン画面で案内する） */
  | { ok: false; outcome: "failed" | "unknown"; error: string; reason?: "not_allowed" }

/** 権限の申請（管理者が承認・却下するまで残る） */
export interface GasRoleRequest {
  role: Role
  note: string
  at: string | null
}

/** getMe：ログインした人。権限は GAS が決める（USER_ROLES で固定、または管理者が付けたもの。無ければ閲覧者） */
export interface GasMe {
  email: string
  name: string
  role: Role
  /** USER_ROLES で固定（画面では変えられない） */
  fixed: boolean
  pendingRequest: GasRoleRequest | null
}

/** listUsers：ALLOWED_EMAILS・USER_ROLES・これまでの記録に出てくる人 */
export interface GasUser {
  email: string
  name: string
  role: Role
  fixed: boolean
  /** ALLOWED_EMAILS に入っている（ログインできる） */
  allowed: boolean
  pendingRequest: GasRoleRequest | null
  lastSeenAt: string | null
}

/** getStatus：X_DRY_RUN / DISCORD_DRY_RUN が有効ならその媒体には投稿しない */
export interface GasStatus {
  dryRun: boolean
  /** 古い GAS では無い（Discord 未対応として扱う） */
  discordDryRun?: boolean
  /** Discord の Bot（DISCORD_BOT_TOKEN・DISCORD_QUIZ_CHANNEL_ID）が設定済みか */
  discordConfigured?: boolean
  /** Gemini の設定と今月の使用量（古い GAS では無い） */
  ai?: GasAiStatus
}

/** AI（Gemini）の状態。monthCostJpy・budgetJpy は有料枠に換算した概算 */
export interface GasAiStatus {
  configured: boolean
  model: string
  verifyModel: string
  /** ファクトチェックで Google 検索を使うか（GEMINI_SEARCH） */
  search: boolean
  monthCostJpy: number
  budgetJpy: number
  /** 今日の Gemini 呼び出しの回数と上限（AI_DAILY_CALL_LIMIT）。古い GAS では無い */
  callsToday?: number
  dailyCallLimit?: number
  /** 毎朝 9:00 の AI 自動生成（AI_DAILY_GENERATION など） */
  daily?: { enabled: boolean; target: number; max: number; verify: boolean; reserve: number }
}

/** verifyQuestion：その版のファクトチェック。sources は出典（記録用。投稿本文には入れない） */
export interface GasFactCheck extends FactCheck {
  version: number
  sources: { title: string; url: string }[]
}

/** generateQuestions：Gemini で作り、検査を通ったものだけ下書きで保存する */
export interface GenerateQuestionsInput {
  platform: Exclude<Platform, "instagram">
  count: number
  theme?: string
  difficulty?: "auto" | "beginner" | "intermediate" | "advanced"
  instructions?: string
  plannedDate?: string
}
export interface GenerateQuestionsResult {
  saved: { id: string; version: number; text: string }[]
  rejected: { text: string; reason: string }[]
  model: string
  estCostJpy: number
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
  /** この版のファクトチェック（未実施なら null。古い GAS では無い） */
  factCheck?: GasFactCheck | null
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
  /** Discord：投稿はできたがリアクションを付けられなかったなど（無ければ null） */
  warning?: string | null
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
  response: Pick<ResponseSnapshot, "responses" | "correct" | "perChoice" | "finalized" | "collectedAt" | "reactionEvents" | "uniqueVoters" | "invalidVoters"> | null
}

/** getAutomationStatus：毎朝の自動投稿の状態（GAS の Daily.gs・Evening.gs） */
export interface GasPlan {
  questionId: string
  version: number
  /** approved：承認済みを固定 / spare：予備から割り当て */
  source: string
  plannedAt: string | null
}
export interface GasPostState {
  outcome: "success" | "unknown"
  questionId: string
  version: number
  postId: string
  dryRun: boolean
}
export interface GasAutomationLog {
  at: string | null
  source: string
  task: string
  step: string
  result: string
  message: string
}
/** 媒体ごとの予約・投稿状態（最上位の同名の項目は X の分） */
export interface GasPlatformAutomation {
  dryRun: boolean
  todayPlan: GasPlan | null
  tomorrowPlan: GasPlan | null
  todayCandidates: { questionId: string; version: number }[]
  tomorrowCandidates: { questionId: string; version: number }[]
  todayPost: GasPostState | null
  yesterdayAnswer: GasPostState | null
  spareCount: number
}
export interface GasAutomationStatus {
  enabled: boolean
  dryRun: boolean
  today: string
  tomorrow: string
  todayPlan: GasPlan | null
  tomorrowPlan: GasPlan | null
  todayCandidates: { questionId: string; version: number }[]
  tomorrowCandidates: { questionId: string; version: number }[]
  todayPost: GasPostState | null
  yesterdayAnswer: GasPostState | null
  spareCount: number
  spareMin: number
  /** Discord の Bot が設定済みなら Discord の分（未設定・古い GAS では null / 無し） */
  discord?: GasPlatformAutomation | null
  /** 運営用チャンネルの Webhook（DISCORD_OPS_WEBHOOK_URL）が設定済みか */
  discordConfigured: boolean
  notifyConfigured: boolean
  recentLog: GasAutomationLog[]
}
