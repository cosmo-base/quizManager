// Shared domain types for Cosmo Base Quiz Manager.
// These mirror the data units in 要件定義書 §15. The backend team owns the final DB schema.

export type Platform = "x" | "discord" | "instagram"
export type ChoiceLabel = "A" | "B" | "C"
export type Difficulty = "auto" | "beginner" | "intermediate" | "advanced"
export type QuestionFormat = "auto" | "name" | "number" | "description" | "year"
export type Timeliness = "auto" | "current" | "evergreen"
export type Role = "admin" | "editor" | "approver" | "viewer"
export type DataMode = "demo" | "live"

export type QuestionStatus =
  | "draft"
  | "verifying"
  | "review"
  | "approved"
  | "returned"
  | "rejected"
  | "scheduled"
  | "posted"
  | "archived"

export type PlanStatus =
  | "unset"
  | "waiting"
  | "generating"
  | "verifying"
  | "review"
  | "confirmed"
  | "scheduled"
  | "posted"
  | "failed"
  | "aggregated"

export type CheckResult = "pass" | "warn" | "fail" | "pending"
export type FactCheckStatus = "pending" | "running" | "passed" | "warning" | "failed"
export type DuplicateLevel = "none" | "weak" | "strong"
export type ImageStatus = "none" | "generating" | "ready" | "stale"
export type CertificationStatus = "none" | "candidate" | "adopted" | "suspended" | "reverify"

export interface Category {
  id: string
  name: string
  active: boolean
}

export interface Choice {
  label: ChoiceLabel
  text: string
}

export interface Source {
  id: string
  title: string
  publisher: string
  url: string
  tier: 1 | 2 | 3 | 4
  excerpt: string
  checkedAt: string
}

export interface FactCheckItem {
  key: string
  label: string
  result: CheckResult
  note?: string
}

export interface FactCheck {
  status: FactCheckStatus
  items: FactCheckItem[]
  concerns: string[]
  checkedAt: string | null
  model: string | null
  /** 実APIモード：難易度・分類が未設定だった問題への AI の案（反映は人が行う） */
  suggestion?: { difficulty: Exclude<Difficulty, "auto"> | null; category: string | null; topic?: string | null } | null
}

export interface QualityScore {
  interest: number
  answerability: number
  choiceValidity: number
  learning: number
  platformFit: number
}

export interface SimilarQuestion {
  questionId: string
  knowledgeId: string
  text: string
  reason: string
  similarity: number
  sameKnowledge: boolean
  platform: Platform
  postedAt: string
  reusableFrom: string
}

export interface QuestionSnapshot {
  text: string
  choices: Choice[]
  answer: ChoiceLabel
  explanation: string
}

export interface QuestionVersion {
  version: number
  hash: string
  createdAt: string
  author: string
  summary: string
  snapshot: QuestionSnapshot
}

export interface PostHistoryEntry {
  postJobId: string
  platform: Platform
  publishedAt: string | null
  externalId: string | null
  url: string | null
  status: PostStatus
  version: number
}

/** null は「未取得」を表す。0 と区別すること。 */
export interface ResponseSnapshot {
  platform: Platform
  postJobId: string
  responses: number | null
  correct: number | null
  perChoice: Record<ChoiceLabel, number | null>
  impressions: number | null
  clicks: number | null
  /** Discord: リアクションイベント総数 */
  reactionEvents?: number | null
  /** Discord: 有効回答者数（ユニーク） */
  uniqueVoters?: number | null
  /** Discord: 複数の番号を選んで無効になった人数 */
  invalidVoters?: number | null
  finalized: boolean
  collectedAt: string | null
}

export interface ReviewEntry {
  at: string
  by: string
  action: "generated" | "approved" | "returned" | "rejected" | "edited" | "reverified" | "auto_approved" | "scheduled"
  note?: string
}

export interface Question {
  id: string
  knowledgeId: string
  topic: string
  text: string
  choices: Choice[]
  answer: ChoiceLabel
  explanation: string
  /** 実APIモードで分類が未設定なら "" */
  categoryId: string
  /** "auto" は未設定（実APIモードで難易度が付いていない問題） */
  difficulty: Difficulty
  platform: Platform
  timeliness: Exclude<Timeliness, "auto">
  status: QuestionStatus
  plannedDate: string | null
  factCheck: FactCheck
  duplicate: { level: DuplicateLevel; similar: SimilarQuestion[]; reusableFrom: string | null }
  quality: QualityScore
  sources: Source[]
  versions: QuestionVersion[]
  confirmedVersion: number | null
  history: PostHistoryEntry[]
  responses: ResponseSnapshot[]
  imageStatus: ImageStatus
  imageVersion: number | null
  templateId: string
  autoApprovable: boolean
  autoApprovalBlockers: string[]
  certification: CertificationStatus
  reviewHistory: ReviewEntry[]
  recheckBy: string | null
  createdAt: string
  updatedAt: string
  generatedBy: string | null
  isSample: boolean
}

export interface PlanSlot {
  id: string
  date: string
  platform: Platform
  categoryId: string | "auto"
  difficulty: Difficulty
  theme: string
  format: QuestionFormat
  timeliness: Timeliness
  time: string
  instructions: string
  generation: "auto" | "manual"
  priority: "normal" | "high"
  status: PlanStatus
  questionId: string | null
  source: "manual" | "template" | "rule" | "ai"
}

export interface WeeklyTemplateRow {
  weekday: number
  platform: Platform
  enabled: boolean
  categoryId: string | "auto"
  difficulty: Difficulty
  timeliness: Timeliness
  generation: "auto" | "manual"
  time: string
}

export type PipelineStepStatus = "pending" | "running" | "done" | "warn" | "error" | "skipped"

export interface PipelineStep {
  key: string
  label: string
  status: PipelineStepStatus
  startedAt: string | null
  finishedAt: string | null
  result?: string
}

export interface GenerationJob {
  id: string
  mode: "daily" | "bulk" | "single"
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  startedAt: string
  finishedAt: string | null
  platforms: Platform[]
  range: { from: string; to: string } | null
  total: number
  completed: number
  success: number
  needsReview: number
  rejected: number
  errors: number
  steps: PipelineStep[]
  model: string
  estimatedCostJpy: number
  actualCostJpy: number | null
  resultIds: string[]
  targetSlotIds: string[]
  options: GenerationOptions
  isDemo: boolean
}

export interface GenerationOptions {
  count: number
  categoryId: string | "auto"
  difficulty: Difficulty
  theme: string
  usePlan: boolean
  usePastAnalysis: boolean
  excludeGenerated: boolean
  autoApprove: boolean
  model: string
  instructions: string
  platform?: Platform
  date?: string
}

export type PostStatus =
  | "draft"
  | "scheduled"
  | "posting"
  | "posted"
  | "failed"
  | "unknown"
  | "manual"
  | "cancelled"

export type ResponseCollectStatus = "not_started" | "collecting" | "provisional" | "finalized" | "failed"

export interface PostJob {
  id: string
  questionId: string
  questionVersion: number
  platform: Platform
  date: string
  scheduledAt: string
  publishedAt: string | null
  status: PostStatus
  url: string | null
  externalId: string | null
  responseStatus: ResponseCollectStatus
  answerRevealed: boolean
  error: string | null
  syncStatus: SyncStatus
  /** 実APIモード：前日 21:00 に固定した版（固定前・固定のない日は無し） */
  plan?: { source: "approved" | "spare"; plannedAt: string | null } | null
}

export type SyncStatus = "unsynced" | "syncing" | "synced" | "failed" | "needs_check"

export interface AppNotification {
  id: string
  level: "info" | "warning" | "error" | "success"
  kind: "post_failed" | "aggregate_failed" | "verify_error" | "review_waiting" | "ig_stock" | "budget" | "sync_failed" | "generation"
  title: string
  description: string
  href: string
  createdAt: string
  read: boolean
}

export interface ActivityLog {
  id: string
  at: string
  actor: string
  action: string
  target: string
  href?: string
}

export interface Integration {
  key: "gemini" | "x" | "discord" | "instagram" | "sheets" | "supabase" | "storage"
  name: string
  status: "demo" | "connected" | "disconnected" | "error" | "unverified"
  note: string
  lastCheckedAt: string | null
}

export interface InsightRule {
  id: string
  text: string
  approved: boolean
}

export interface AIInsight {
  id: string
  scope: "question" | "questions" | "category" | "platform" | "period" | "certification"
  targetLabel: string
  createdAt: string
  model: string
  status: "running" | "completed" | "failed"
  facts: string[]
  hypotheses: string[]
  improvements: InsightRule[]
  verification: string[]
  cautions: string[]
  isDemo: boolean
}

export interface SyncLog {
  id: string
  at: string
  target: string
  rows: number
  status: SyncStatus
  message: string
}

export interface ImageTemplate {
  id: string
  name: string
  platform: Platform
  aspect: "1:1" | "16:9" | "4:5"
  background: "orbit" | "grid" | "plain"
  accent: string
  active: boolean
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  lastActiveAt: string
}

export interface UsageRecord {
  month: string
  aiJpy: number
  snsJpy: number
  dbJpy: number
}

export interface SystemSettings {
  dataMode: DataMode
  automationPaused: boolean
  emergencyStop: boolean
  verificationMode: boolean
  brand: { name: string; logoText: string; logoDataUrl: string | null }
  kpiDashboardUrl: string
  ai: {
    defaultModel: string
    stepModels: { generate: string; verify: string; analyze: string }
    searchEnabled: boolean
    maxRegenerations: number
    dailyGenerationTime: string
    dailyGenerationEnabled: boolean
    dailyLookaheadDays: number
    monthlyBudgetJpy: number
    budgetWarnRatio: number
    stopOnBudget: boolean
  }
  posting: {
    defaultTime: string
    precheckTime: string
    closeTime: string
    answerTime: string
    instagramActive: boolean
    instagramMinStock: number
    failureNotifyTo: string
  }
  rules: {
    sameplatformMonths: number
    crossPlatformMonths: number
    balanceAnswerPosition: boolean
    platformPolicies: Record<Platform, string>
    difficultyDefinitions: Record<Exclude<Difficulty, "auto">, string>
    qualityItems: { key: keyof QualityScore; label: string; enabled: boolean }[]
    recheckDaysForCurrent: number
    approvedInsightRules: string[]
  }
  sheets: {
    spreadsheetName: string
    targetTab: string
    autoSync: boolean
  }
  notifications: Record<AppNotification["kind"], { inApp: boolean; email: boolean }>
}
