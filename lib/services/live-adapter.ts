// 実APIモード用アダプター。GAS Web アプリへ POST する（action 名は lib/services/gas-contract.ts）。
// 接続済み：問題の保存・一覧、X の出題・正解発表・結果取得・公開状況、自動投稿の状態・切り替え、接続テスト。
// 未実装の処理は必ず NotConnectedError を投げ、UI上で成功を偽装しないこと。
import type { Integration, PostJob } from "@/lib/types"
import { callGas } from "./gas-client"
import type { GasAutomationStatus, GasPostJob, GasQuestion, GasStatus, PostTarget, PublishPostResult } from "./gas-contract"
import { NotConnectedError, type QuizBackend } from "./types"

const notConnected = (operation: string, hint: string) => () => Promise.reject(new NotConnectedError(operation, hint))

function target(job: PostJob): PostTarget {
  if (job.platform === "instagram") throw new NotConnectedError("投稿", "Instagram は休止中です")
  return { date: job.date, platform: job.platform }
}

export const liveBackend: QuizBackend = {
  mode: "live",
  verifyQuestion: notConnected("ファクトチェック", "GAS action=verifyQuestion（Gemini + 検索）"),
  publishPost: (job) =>
    callGas<PublishPostResult>("publishPost", { ...target(job), questionId: job.questionId, version: job.questionVersion }, "投稿"),
  checkPostStatus: (job) => callGas("checkPostStatus", target(job), "公開状況の確認"),
  revealAnswer: async (job) => {
    await callGas("revealAnswer", target(job), "正解発表")
  },
  fetchResponses: (job) => callGas("fetchResponses", target(job), "回答結果の取得"),
  syncToSheets: notConnected("Sheets同期", "実APIモードでは GAS が直接 Sheets に記録するため不要です"),
  runInsight: notConnected("AI定性分析", "GAS action=runInsight"),
  testConnection: async (key) => (await callGas<{ status: Integration["status"] }>("testConnection", { key }, "接続テスト")).status,
  getStatus: () => callGas<GasStatus>("getStatus", {}, "状態の取得"),
  listQuestions: () => callGas<GasQuestion[]>("listQuestions", {}, "問題の読み込み"),
  saveQuestion: (input) => callGas<GasQuestion>("saveQuestion", input, "問題の保存"),
  listPostJobs: () => callGas<GasPostJob[]>("listPostJobs", {}, "投稿の読み込み"),
  getAutomationStatus: () => callGas<GasAutomationStatus>("getAutomationStatus", {}, "自動投稿の状態の取得"),
  setAutomationEnabled: (enabled) => callGas<{ enabled: boolean }>("setAutomationEnabled", { enabled }, "自動投稿の切り替え"),
}
