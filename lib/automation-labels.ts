// 自動処理の記録（automation_log の result）の表示。成功・失敗・要確認を色と言葉で分ける
import type { Tone } from "@/lib/constants"

export const RESULT_TONE: Record<string, Tone> = { done: "success", ok: "success", skip: "muted", error: "danger", notified: "warning", start: "info" }
export const RESULT_LABEL: Record<string, string> = { done: "完了", ok: "問題なし", skip: "対象なし", error: "エラー", notified: "要確認（通知済み）", start: "開始" }
