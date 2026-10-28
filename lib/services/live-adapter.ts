// 実APIモード用アダプター。GAS Web アプリへ POST する（action 名は lib/services/gas-contract.ts）。
// 接続済み：問題の保存・一覧、X・Discord の出題・正解発表・結果取得・公開状況、自動投稿の状態・切り替え、接続テスト、
// Gemini による問題の生成（下書き保存）とファクトチェック。
// 未実装の処理は必ず NotConnectedError を投げ、UI上で成功を偽装しないこと。
import type { AIInsight, Integration, PostJob, Role } from "@/lib/types"
import { callGas } from "./gas-client"
import type { GasAutomationStatus, GasFactCheck, GasMe, GasPostJob, GasQuestion, GasRoleRequest, GasStatus, GasUser, GenerateQuestionsResult, ImportQuestionsResult, PostTarget, PublishPostResult } from "./gas-contract"
import { NotConnectedError, type QuizBackend } from "./types"

const notConnected = (operation: string, hint: string) => () => Promise.reject(new NotConnectedError(operation, hint))

function target(job: PostJob): PostTarget {
  if (job.platform === "instagram") throw new NotConnectedError("投稿", "Instagram は休止中です")
  return { date: job.date, platform: job.platform }
}

export const liveBackend: QuizBackend = {
  mode: "live",
  // 画面に出している最新版を確認する
  verifyQuestion: (q) => callGas<GasFactCheck>("verifyQuestion", { questionId: q.id, version: q.versions[q.versions.length - 1]?.version }, "ファクトチェック"),
  publishPost: (job) =>
    callGas<PublishPostResult>("publishPost", { ...target(job), questionId: job.questionId, version: job.questionVersion }, "投稿"),
  checkPostStatus: (job) => callGas("checkPostStatus", target(job), "公開状況の確認"),
  revealAnswer: async (job) => {
    await callGas("revealAnswer", target(job), "正解発表")
  },
  fetchResponses: (job) => callGas("fetchResponses", target(job), "回答結果の取得"),
  syncToSheets: notConnected("Sheets同期", "実APIモードでは GAS が直接 Sheets に記録するため不要です"),
  runInsight: (req) => callGas<AIInsight>("runInsight", { scope: req.scope, targetLabel: req.targetLabel, questionIds: req.questionIds }, "AI定性分析"),
  recordManualPost: (job, url) =>
    callGas<{ externalId: string; url: string }>("recordManualPost", { ...target(job), questionId: job.questionId, version: job.questionVersion, url }, "手動投稿の記録"),
  listInsights: () => callGas<AIInsight[]>("listInsights", {}, "分析履歴の取得"),
  testConnection: async (key) => (await callGas<{ status: Integration["status"] }>("testConnection", { key }, "接続テスト")).status,
  getStatus: () => callGas<GasStatus>("getStatus", {}, "状態の取得"),
  listQuestions: () => callGas<GasQuestion[]>("listQuestions", {}, "問題の読み込み"),
  saveQuestion: (input) => callGas<GasQuestion>("saveQuestion", input, "問題の保存"),
  listPostJobs: () => callGas<GasPostJob[]>("listPostJobs", {}, "投稿の読み込み"),
  getAutomationStatus: () => callGas<GasAutomationStatus>("getAutomationStatus", {}, "自動投稿の状態の取得"),
  setAutomationEnabled: (enabled) => callGas<{ enabled: boolean }>("setAutomationEnabled", { enabled }, "自動投稿の切り替え"),
  generateQuestions: (input) => callGas<GenerateQuestionsResult>("generateQuestions", input, "AI問題生成"),
  getQuestionHistory: (questionId) => callGas<GasQuestion[]>("getQuestionHistory", { questionId }, "履歴の取得"),
  importQuestions: (rows, fileName) => callGas<ImportQuestionsResult>("importQuestions", { rows, fileName }, "問題の取り込み"),
  getMe: () => callGas<GasMe>("getMe", {}, "ユーザー情報の取得"),
  requestRole: (role, note) => callGas<{ pendingRequest: GasRoleRequest }>("requestRole", { role, note }, "権限の申請"),
  listUsers: () => callGas<GasUser[]>("listUsers", {}, "ユーザー一覧の取得"),
  setUserRole: (email, role) => callGas<{ email: string; role: Role }>("setUserRole", { email, role }, "権限の変更"),
  rejectRoleRequest: (email) => callGas<{ email: string }>("rejectRoleRequest", { email }, "申請の却下"),
}
