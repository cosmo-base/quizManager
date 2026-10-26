// 実APIモード用アダプター（未実装）。
// バックエンド担当者は各メソッドを Supabase Edge Functions / Route Handlers 呼び出しに置き換えてください。
// 未実装の処理は必ず NotConnectedError を投げ、UI上で成功を偽装しないこと。
import { NotConnectedError, type QuizBackend } from "./types"

const notConnected = (operation: string, hint: string) => () => Promise.reject(new NotConnectedError(operation, hint))

export const liveBackend: QuizBackend = {
  mode: "live",
  verifyQuestion: notConnected("ファクトチェック", "POST /functions/v1/verify-question（Gemini + 検索）"),
  publishPost: notConnected("投稿", "POST /functions/v1/post-publish（X API / Discord Bot）"),
  checkPostStatus: notConnected("公開状況の確認", "GET /functions/v1/post-status?jobId="),
  revealAnswer: notConnected("正解発表", "POST /functions/v1/post-answer"),
  fetchResponses: notConnected("回答結果の取得", "POST /functions/v1/collect-responses"),
  syncToSheets: notConnected("Sheets同期", "POST /functions/v1/sheets-sync（Google Sheets API）"),
  runInsight: notConnected("AI定性分析", "POST /functions/v1/ai-insight"),
  testConnection: notConnected("接続テスト", "GET /functions/v1/health"),
}
