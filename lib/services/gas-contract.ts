// GAS Web アプリとの通信契約（決定事項：ロジックは GAS、データの正本は Google Sheets）。
// 管理画面は Google ログインの ID トークンを付けて POST し、GAS 側で検証・許可メールアドレスと照合する。
// GAS 側の実装：WebApp.gs（振り分け）・Questions.gs・Posting.gs
import type { ChoiceLabel, Choice, Difficulty, FactCheck, Platform, PostStatus, QuestionStatus, ResponseSnapshot, Role } from "@/lib/types"

export type GasAction =
  | "startSession"
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
  | "recordManualPost"
  | "recordResponses"
  | "syncKpiSheet"
  | "importQuestions"
  | "getQuestionHistory"
  | "getMe"
  | "requestRole"
  | "listUsers"
  | "setUserRole"
  | "rejectRoleRequest"
  | "syncToSheets"
  | "runInsight"
  | "renderQuizCard"
  | "listPastQuestions"
  | "importPastQuestions"
  // 過去問サイト（Archive）。GAS の Archive.gs が Archive の GAS に中継する
  | "archiveListQuestions"
  | "archiveGetQuestion"
  | "archiveSaveQuestion"
  | "archiveListReports"
  | "archiveUpdateReport"
  | "archiveListNotices"
  | "archiveSaveNotice"
  | "archiveSimilarCandidates"
  | "archiveSimilarMerge"
  | "archiveSimilarDismiss"

export interface GasRequest<P = unknown> {
  action: GasAction
  /** ログインのセッション（startSession で GAS が出した7日もつもの。GAS 側で署名と期限を確認） */
  session?: string
  /** Google ログインの ID トークン（startSession で使う。古い GAS には毎回これを送る） */
  idToken?: string
  /** ポータルからの引換券（startSession でだけ使う） */
  ticket?: string
  payload: P
}

export type GasResponse<T> =
  | { ok: true; data: T }
  /** outcome=unknown は成否不明。UI から自動で再実行しないこと */
  /** reason=not_allowed は使えないアカウント（ログイン画面で案内する）。auth はログインの期限切れ（ログインし直す） */
  | { ok: false; outcome: "failed" | "unknown"; error: string; reason?: "not_allowed" | "auth" }

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
  /**
   * FSIF のアクセス権限管理につないでいるとき（GAS の AccessLink.gs）。
   * 利用の可否と権限はアクセス権限管理で決まるので、この画面では申請・変更しない。古い GAS・未接続なら無い
   */
  access?: GasAccessLink | null
}

export interface GasAccessLink {
  /** アクセス権限管理の画面の URL */
  url: string
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
  /** 設定画面に出す値（秘密情報は出さず、設定済みかどうかだけ。古い GAS では無い） */
  config?: GasConfigSummary
}

export interface GasConfigSummary {
  automationEnabled: boolean
  allowLivePost: boolean
  /** Discord への送信を Supabase の中継経由にしているか */
  discordRelay: boolean
  discordGuild: boolean
  /** 運営用チャンネル（DISCORD_OPS_WEBHOOK_URL）・通知メール（NOTIFY_EMAIL） */
  opsWebhook: boolean
  notifyEmail: boolean
  supabaseHeartbeat: boolean
  spareMinStock: number
  /** 明日から何日分が承認済みで埋まっていれば、予備が少なくても知らせず AI 生成もしないか（古い GAS では無い） */
  spareCoverDays?: number
  /** KPI ダッシュボードの元データ（KPI_SHEET_ID）への反映が設定済みか（古い GAS では無い） */
  kpiSheet?: boolean
  /** カード画像のテンプレート（QUIZ_CARD_TEMPLATE_ID）。古い GAS では無い */
  quizCards?: boolean
  /** 過去問サイトとの連携（ARCHIVE_API_URL・ARCHIVE_ADMIN_TOKEN）が設定済みか。古い GAS では無い */
  archive?: boolean
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
  /** 分類の ID。指定するとすべてその分類で作る */
  category?: string
}
export interface GenerateQuestionsResult {
  saved: { id: string; version: number; text: string }[]
  rejected: { text: string; reason: string }[]
  model: string
  estCostJpy: number
}

/** questions タブの最新版（保存のたびに版が 1 つ上がる） */
/** 過去問（以前のスプレッドシート「宇宙クイズ」で出した問題。かぶりの確認用。ライブラリ・予備・KPI には混ぜない） */
export interface GasPastQuestion {
  /** 表示名（例：過去問 2026-03-04（12 行目）） */
  id: string
  date: string | null
  text: string
  choices: string[]
  /** 正解の文字（分からなければ回答の欄のまま） */
  answer: string
  category: string
  platforms: string[]
  answers: number
  correct: number
}

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
  /** 難易度・分類（未設定なら null。古い GAS では無い） */
  difficulty?: Exclude<Difficulty, "auto"> | null
  category?: string | null
  /** 題材（「木星」など。未設定なら null） */
  topic?: string | null
  /** 前振り・画像（正解カード）用の短い解説（古い GAS では無い） */
  lead?: string
  cardSummary?: string
  /** この版を保存したときのメモ（差し戻し・不採用の理由など） */
  note?: string
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
  /** 省略すると前の版の値を引き継ぐ。null で未設定に戻す */
  difficulty?: Exclude<Difficulty, "auto"> | null
  category?: string | null
  topic?: string | null
  /** ファクトチェックをしていない中身を、人の判断で承認するときの理由（検証NG は不可） */
  manualApproval?: string
  /** 省略すると前の版の値を引き継ぐ */
  lead?: string
  cardSummary?: string
}

/** importQuestions：Excel・CSV から読み込んだ問題を下書きでまとめて登録する（1 回 100 問まで） */
export interface ImportQuestionInput {
  /** 画面で振った番号（結果をどの行のものか対応させる） */
  ref: string
  text: string
  choices: Choice[]
  answer: ChoiceLabel
  explanation: string
  platform: Exclude<Platform, "instagram">
  plannedDate: string | null
  note?: string
  difficulty?: Exclude<Difficulty, "auto"> | null
  category?: string | null
  topic?: string | null
  lead?: string
  cardSummary?: string
}
export interface ImportQuestionsResult {
  saved: { ref: string; id: string; platform: Platform }[]
  rejected: { ref: string; reason: string }[]
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
  /** 明日から続けて何日先まで承認済みで埋まっているか（古い GAS では無い） */
  coveredDays?: number
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
  /** X の、明日から承認済みで埋まっている日数（古い GAS では無い） */
  coveredDays?: number
  /** この日数以上埋まっていれば、予備が少なくても不足として扱わない（SPARE_COVER_DAYS） */
  coverDays?: number
  /** Discord の Bot が設定済みなら Discord の分（未設定・古い GAS では null / 無し） */
  discord?: GasPlatformAutomation | null
  /** 運営用チャンネルの Webhook（DISCORD_OPS_WEBHOOK_URL）が設定済みか */
  discordConfigured: boolean
  notifyConfigured: boolean
  recentLog: GasAutomationLog[]
}

/* ---------- 過去問サイト（Archive）。形は Archive の GAS（admin.*）と同じ ---------- */

export type ArchiveFieldId = "astronomy" | "development" | "business" | "exploration" | "history" | "basics" | "policy"
export type ArchiveQuestionStatus = "published" | "stopped"
export type ArchiveDifficulty = "beginner" | "intermediate" | "advanced" | "expert" | "unknown"
/** 手で固定できる難易度（不明には固定しない） */
export type ArchiveFixedDifficulty = Exclude<ArchiveDifficulty, "unknown">
export type ArchiveReportStatus = "received" | "resolved" | "dismissed"
export type ArchiveReportReason = "answer" | "text" | "explanation" | "other"
export type ArchiveChoiceId = "A" | "B" | "C"

export interface ArchiveReference {
  title: string
  url: string
  publisher: string
}

/** archiveListQuestions：全問題（停止中・公開前も含む） */
export interface ArchiveQuestionSummary {
  id: string
  status: ArchiveQuestionStatus
  fieldId: ArchiveFieldId
  postedOn: string
  publishFrom: string
  platforms: string[]
  text: string
  choices: { id: ArchiveChoiceId; text: string }[]
  correct: string
  versionId: string
  versionNo: number
  /** サイトで使っている難易度（固定していれば固定した値） */
  difficulty: ArchiveDifficulty
  /** 自動の判定（固定していないときの値）。古い GAS では無い */
  autoDifficulty?: ArchiveDifficulty
  /** 運営が手で固定した難易度。空なら自動。古い GAS では無い */
  difficultyOverride?: ArchiveFixedDifficulty | ""
  /** 運営の見積もり（推定の出発点）。空は未設定。GAS 1.8.0 から */
  difficultyPrior?: ArchiveFixedDifficulty | ""
  /** 似た問題のまとまり（まとまりの元の問題ID）。空ならなし。GAS 1.8.0 から */
  similarGroup?: string
  /** 時事問題（サイトに「出題時点の内容です」と出す）。GAS 1.8.0 から */
  timeSensitive?: boolean
  /** 参加者に見せている正答率（null は未集計） */
  displayAccuracy: number | null
  basicAnswers: number
  /** 未対応の誤り報告の数 */
  openReports: number
}

export interface ArchiveVersion {
  versionId: string
  versionNo: number
  text: string
  choices: Record<ArchiveChoiceId, string>
  correct: string
  explanation: string
  references: ArchiveReference[]
  statsVersionId: string
  prevVersionId: string
  createdAt: string
  createdBy: string
  changeReason: string
}

export interface ArchiveReport {
  reportId: string
  questionId: string
  versionId: string
  attemptId: string
  reason: ArchiveReportReason
  detail: string
  createdAt: string
  status: ArchiveReportStatus
}

/** archiveGetQuestion：1問の全内容。versions は新しい順 */
export interface ArchiveQuestionDetail {
  question: {
    id: string
    status: ArchiveQuestionStatus
    fieldId: ArchiveFieldId
    postedOn: string
    publishFrom: string
    platforms: string[]
    currentVersionId: string
    snsAccuracy: number | null
    difficulty: ArchiveDifficulty
    autoDifficulty?: ArchiveDifficulty
    difficultyOverride?: ArchiveFixedDifficulty | ""
    displayAccuracy: number | null
    basicAnswers: number
    difficultyPrior?: ArchiveFixedDifficulty | ""
    similarGroup?: string
    timeSensitive?: boolean
  }
  /** 同じまとまりのほかの問題。GAS 1.8.0 から */
  similar?: ArchiveSimilarQuestion[]
  /** 答えが分かってしまうため、同じ回に出さない問題（どちらかの答えが、もう一方の問題文に出ている）。GAS 1.8.0 から */
  hintConflicts?: { id: string; text: string; word: string; status: ArchiveQuestionStatus }[]
  versions: ArchiveVersion[]
  reports: ArchiveReport[]
  /** 保存したときだけ */
  saved?: { changed: boolean; newVersionId?: string | null; statsReset?: boolean }
}

export interface ArchiveSaveQuestionInput {
  questionId: string
  /** 開いたときの版（ほかの人が先に直していたら保存しない） */
  baseVersionId: string
  text: string
  choices: Record<ArchiveChoiceId, string>
  correct: ArchiveChoiceId
  explanation: string
  references: ArchiveReference[]
  fieldId: ArchiveFieldId
  status: ArchiveQuestionStatus
  /** 内容を変えたときは必須（版の記録に残る） */
  changeReason: string
  /** 正答率を数え直す（正解・選択肢を変えたときは GAS が必ず数え直す） */
  resetStats: boolean
  /** 難易度を手で固定する（空で自動に戻す）。版は増えない */
  difficultyOverride: ArchiveFixedDifficulty | ""
  /** 以下は版を増やさない。送らなければ変えない（GAS 1.8.0 から） */
  /** 運営の見積もり（空で未設定） */
  difficultyPrior?: ArchiveFixedDifficulty | ""
  /** 似た問題のまとまり（問題ID。空でまとまりから外す） */
  similarGroup?: string
  timeSensitive?: boolean
}

/** 似た問題の候補の1問分 */
export interface ArchiveSimilarCard {
  id: string
  text: string
  correctText: string
  postedOn: string
  platforms: string[]
  status: ArchiveQuestionStatus
  /** 今のまとまり（空ならなし） */
  similarGroup: string
}

/** archiveSimilarCandidates：まだ同じまとまりでなく、「違う」としていない組み合わせ（近い順） */
export interface ArchiveSimilarCandidates {
  /** 候補の全数（返したのは先頭の limit 組） */
  total: number
  candidates: {
    a: ArchiveSimilarCard
    b: ArchiveSimilarCard
    /** 近さ（0〜1） */
    score: number
    /** 答えが分かってしまう組み合わせとして、すでに同じ回に出さない */
    hint: boolean
  }[]
}

/** 同じまとまりの問題（問題の画面に出す） */
export interface ArchiveSimilarQuestion {
  id: string
  text: string
  /** 正解の選択肢の文字 */
  correctText: string
  postedOn: string
  status: ArchiveQuestionStatus
}

export interface ArchiveNotice {
  noticeId: string
  kind: "info" | "correction"
  title: string
  summary: string
  body: string
  questionId: string
  before: string
  after: string
  publishedAt: string
  endsAt: string
}

export type ArchiveSaveNoticeInput = Omit<ArchiveNotice, "noticeId"> & { noticeId?: string }

/** startSession：Google の ID トークンかポータルの引換券で、7日もつセッションを出す */
export interface GasSession {
  session: string
  expiresAt: string
  me: { email: string; name: string }
}
