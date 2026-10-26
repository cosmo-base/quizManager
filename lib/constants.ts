import type {
  CertificationStatus,
  Difficulty,
  FactCheckStatus,
  Platform,
  PlanStatus,
  PostStatus,
  QuestionFormat,
  QuestionStatus,
  ResponseCollectStatus,
  Role,
  SyncStatus,
  Timeliness,
  DuplicateLevel,
  ImageStatus,
} from "@/lib/types"

export const PLATFORMS: Platform[] = ["x", "discord", "instagram"]

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X",
  discord: "Discord",
  instagram: "Instagram",
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  auto: "自動",
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
}

export const FORMAT_LABEL: Record<QuestionFormat, string> = {
  auto: "自動",
  name: "名称",
  number: "数値",
  year: "年代",
  description: "説明文",
}

export const TIMELINESS_LABEL: Record<Timeliness, string> = {
  auto: "自動",
  current: "時事",
  evergreen: "恒常的知識",
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "管理者",
  editor: "編集者",
  approver: "承認者",
  viewer: "閲覧者",
}

export const WEEKDAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"]

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted"

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: Tone }> = {
  unset: { label: "未設定", tone: "muted" },
  waiting: { label: "生成待ち", tone: "neutral" },
  generating: { label: "生成中", tone: "info" },
  verifying: { label: "検証中", tone: "info" },
  review: { label: "確認待ち", tone: "warning" },
  confirmed: { label: "確定", tone: "success" },
  scheduled: { label: "予約済み", tone: "info" },
  posted: { label: "投稿済み", tone: "success" },
  failed: { label: "投稿失敗", tone: "danger" },
  aggregated: { label: "集計済み", tone: "neutral" },
}

export const QUESTION_STATUS: Record<QuestionStatus, { label: string; tone: Tone }> = {
  draft: { label: "下書き", tone: "muted" },
  verifying: { label: "検証中", tone: "info" },
  review: { label: "確認待ち", tone: "warning" },
  approved: { label: "確定", tone: "success" },
  returned: { label: "差し戻し", tone: "warning" },
  rejected: { label: "不採用", tone: "danger" },
  scheduled: { label: "予約済み", tone: "info" },
  posted: { label: "出題済み", tone: "neutral" },
  archived: { label: "アーカイブ", tone: "muted" },
}

export const FACTCHECK_STATUS: Record<FactCheckStatus, { label: string; tone: Tone }> = {
  pending: { label: "未検証", tone: "muted" },
  running: { label: "検証中", tone: "info" },
  passed: { label: "検証OK", tone: "success" },
  warning: { label: "要確認", tone: "warning" },
  failed: { label: "検証NG", tone: "danger" },
}

export const DUPLICATE_LEVEL: Record<DuplicateLevel, { label: string; tone: Tone }> = {
  none: { label: "重複なし", tone: "success" },
  weak: { label: "関連あり", tone: "neutral" },
  strong: { label: "強い重複疑義", tone: "danger" },
}

export const IMAGE_STATUS: Record<ImageStatus, { label: string; tone: Tone }> = {
  none: { label: "未生成", tone: "muted" },
  generating: { label: "生成中", tone: "info" },
  ready: { label: "生成済み", tone: "success" },
  stale: { label: "旧版（無効）", tone: "warning" },
}

export const POST_STATUS: Record<PostStatus, { label: string; tone: Tone }> = {
  draft: { label: "準備中", tone: "muted" },
  scheduled: { label: "予約済み", tone: "info" },
  posting: { label: "投稿処理中", tone: "info" },
  posted: { label: "投稿済み", tone: "success" },
  failed: { label: "投稿失敗", tone: "danger" },
  unknown: { label: "公開状況不明", tone: "warning" },
  manual: { label: "手動対応", tone: "warning" },
  cancelled: { label: "取消", tone: "muted" },
}

export const RESPONSE_STATUS: Record<ResponseCollectStatus, { label: string; tone: Tone }> = {
  not_started: { label: "未取得", tone: "muted" },
  collecting: { label: "回答受付中", tone: "info" },
  provisional: { label: "暫定値", tone: "warning" },
  finalized: { label: "確定値", tone: "success" },
  failed: { label: "取得失敗", tone: "danger" },
}

export const SYNC_STATUS: Record<SyncStatus, { label: string; tone: Tone }> = {
  unsynced: { label: "未同期", tone: "muted" },
  syncing: { label: "同期中", tone: "info" },
  synced: { label: "同期済み", tone: "success" },
  failed: { label: "同期失敗", tone: "danger" },
  needs_check: { label: "要確認", tone: "warning" },
}

export const CERT_STATUS: Record<CertificationStatus, { label: string; tone: Tone }> = {
  none: { label: "—", tone: "muted" },
  candidate: { label: "検定候補", tone: "info" },
  adopted: { label: "検定採用", tone: "success" },
  suspended: { label: "利用停止", tone: "danger" },
  reverify: { label: "再検証必要", tone: "warning" },
}

export const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: "conditions", label: "出題条件を取得" },
  { key: "past", label: "過去問題を検索" },
  { key: "trends", label: "媒体別の回答傾向を取得" },
  { key: "generate", label: "問題候補を生成" },
  { key: "duplicate", label: "重複判定" },
  { key: "quality", label: "良問評価" },
  { key: "sources", label: "出典検索・事実確認" },
  { key: "unique", label: "正解一意性の判定" },
  { key: "optimize", label: "媒体別の最適化" },
  { key: "recheck", label: "最終再検証" },
  { key: "autoapprove", label: "自動承認の可否判定" },
  { key: "confirm", label: "確定版の生成" },
  { key: "image", label: "画像生成" },
  { key: "queue", label: "出題キューへ登録" },
]

export const AI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash（推奨・低コスト）", costPerQuestion: 1.8 },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro（高精度）", costPerQuestion: 7.5 },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite（最安）", costPerQuestion: 0.6 },
]

export const PLATFORM_TEXT_LIMIT: Record<Platform, { question: number; choice: number }> = {
  x: { question: 280, choice: 25 },
  discord: { question: 2000, choice: 80 },
  instagram: { question: 2200, choice: 60 },
}

export const SOURCE_TIER_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "一次資料（宇宙機関・官公庁・研究）",
  2: "公式資料（企業・大学・研究機関）",
  3: "専門報道・解説",
  4: "その他参考情報",
}
