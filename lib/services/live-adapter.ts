// 実APIモード用アダプター（未実装）。
// 各メソッドは GAS Web アプリへの POST（action 名は lib/services/gas-contract.ts）に置き換える。
// X 連携は GAS 側の X API PoC（OAuth 1.0a）の合格後に接続する。
// 未実装の処理は必ず NotConnectedError を投げ、UI上で成功を偽装しないこと。
import { NotConnectedError, type QuizBackend } from "./types"

const notConnected = (operation: string, hint: string) => () => Promise.reject(new NotConnectedError(operation, hint))

export const liveBackend: QuizBackend = {
  mode: "live",
  verifyQuestion: notConnected("ファクトチェック", "GAS action=verifyQuestion（Gemini + 検索）"),
  publishPost: notConnected("投稿", "GAS action=publishPost（X API：本文＋投票 1/2/3 ／ Discord Bot）"),
  checkPostStatus: notConnected("公開状況の確認", "GAS action=checkPostStatus（投稿ログの日付×媒体で照会）"),
  revealAnswer: notConnected("正解発表", "GAS action=revealAnswer（X：問題投稿へのリプライ）"),
  fetchResponses: notConnected("回答結果の取得", "GAS action=fetchResponses（X：投票結果 poll.options）"),
  syncToSheets: notConnected("Sheets同期", "GAS action=syncToSheets（Sheets が正本）"),
  runInsight: notConnected("AI定性分析", "GAS action=runInsight"),
  testConnection: notConnected("接続テスト", "GAS action=testConnection"),
}
