// デモモード用の擬似バックエンド。外部API（Gemini / X / Discord / Sheets）には一切通信しません。
import type { ChoiceLabel, FactCheck, ResponseSnapshot } from "@/lib/types"
import type { QuizBackend } from "./types"
import { DEMO_NOW } from "@/lib/format"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const mockBackend: QuizBackend = {
  mode: "demo",

  async verifyQuestion(question) {
    await wait(1400)
    const limitOk = question.choices.every((c) => c.text.length <= 40)
    const hasSources = question.sources.length > 0
    const strongDup = question.duplicate.level === "strong"
    const items: FactCheck["items"] = question.factCheck.items.map((item) => {
      if (item.key === "source_exists" && !hasSources) return { ...item, result: "fail", note: "出典が登録されていません" }
      if (item.key === "duplicate" && strongDup) return { ...item, result: "fail", note: "強い重複疑義が残っています" }
      if (item.key === "length" && !limitOk) return { ...item, result: "warn", note: "選択肢が長すぎる可能性" }
      if (item.key === "freshness" && question.timeliness === "current") return { ...item, result: "warn", note: "時事情報のため投稿前に再確認" }
      return { key: item.key, label: item.label, result: "pass" }
    })
    const hasFail = items.some((i) => i.result === "fail")
    const hasWarn = items.some((i) => i.result === "warn")
    return {
      status: hasFail ? "failed" : hasWarn ? "warning" : "passed",
      items,
      concerns: hasFail ? ["必須条件を満たしていない項目があります"] : hasWarn ? ["人間による確認を推奨する項目があります"] : [],
      checkedAt: new Date().toISOString(),
      model: "gemini-2.5-pro（デモ擬似判定）",
    }
  },

  async publishPost(job) {
    await wait(1200)
    const externalId = `demo-${job.id.toLowerCase()}`
    return {
      externalId,
      url: job.platform === "x" ? `https://x.com/cosmobase_jp/status/${externalId}` : `https://discord.com/channels/demo/${externalId}`,
      publishedAt: new Date().toISOString(),
    }
  },

  async checkPostStatus(job) {
    await wait(1000)
    // デモでは「投稿は公開されていた」ケースを再現
    const externalId = `demo-found-${job.id.toLowerCase()}`
    return { found: true, externalId, url: job.platform === "x" ? `https://x.com/cosmobase_jp/status/${externalId}` : `https://discord.com/channels/demo/${externalId}` }
  },

  async revealAnswer() {
    await wait(800)
  },

  async fetchResponses(job, question) {
    await wait(1000)
    const total = job.platform === "x" ? 180 + (question.id.charCodeAt(9) % 9) * 21 : 40 + (question.id.charCodeAt(9) % 7) * 4
    const rate = 0.55 + (question.id.charCodeAt(10) % 4) * 0.08
    const correct = Math.round(total * rate)
    const others = (["A", "B", "C"] as ChoiceLabel[]).filter((l) => l !== question.answer)
    const rest = total - correct
    const perChoice = { A: 0, B: 0, C: 0 } as Record<ChoiceLabel, number>
    perChoice[question.answer] = correct
    perChoice[others[0]] = Math.round(rest * 0.6)
    perChoice[others[1]] = rest - Math.round(rest * 0.6)
    const snap: ResponseSnapshot = {
      platform: job.platform,
      postJobId: job.id,
      responses: total,
      correct,
      perChoice,
      impressions: job.platform === "x" ? total * 31 : null,
      clicks: job.platform === "x" ? Math.round(total * 0.9) : null,
      finalized: true,
      collectedAt: DEMO_NOW,
      ...(job.platform === "discord" ? { reactionEvents: total + 3, uniqueVoters: total } : {}),
    }
    return snap
  },

  async syncToSheets(jobs) {
    await wait(1200)
    return { rows: jobs.length }
  },

  async runInsight(req) {
    await wait(2200)
    return {
      facts: [
        `対象（${req.targetLabel}）の${req.questionIds.length}問のうち、回答数が取得できたのは確定値の問題のみです`,
        "初級・名称問題の平均回答数は、数値・年号問題より高い傾向がサンプル上で見られます",
        "正答率90%以上の問題は、誤答選択肢の知名度が低い傾向があります",
      ],
      hypotheses: [
        "誤答選択肢が「聞いたことがある」ものだと、回答時に考える楽しさが生まれる可能性",
        "年号問題は正解を知らない人が回答を見送っている可能性（表示数に対する回答率で検証が必要）",
      ],
      improvements: [
        { id: `R-${Date.now()}-1`, text: "誤答選択肢には同じ分野で知名度のある名称を採用する", approved: false },
        { id: `R-${Date.now()}-2`, text: "年号問題は解説に「覚え方」を添え、Discordで先行して出題する", approved: false },
      ],
      verification: ["改善案適用後の2週間と直前2週間で、媒体別の平均回答数と正答率を比較する"],
      cautions: ["これはデモ用の擬似分析結果です。実データに基づく分析ではありません", "媒体横断の回答数はユニーク人数ではありません"],
    }
  },

  async testConnection() {
    await wait(700)
    return "demo"
  },

  // デモモードは画面内のサンプルデータを使うため、正本の読み書きは呼ばれない
  getStatus: () => Promise.resolve({ dryRun: true }),
  listQuestions: () => Promise.resolve([]),
  saveQuestion: () => Promise.reject(new Error("デモモードでは正本に保存しません")),
  listPostJobs: () => Promise.resolve([]),
  getAutomationStatus: () => Promise.reject(new Error("デモモードでは自動投稿の状態を取得しません")),
  setAutomationEnabled: () => Promise.reject(new Error("デモモードでは自動投稿を切り替えません")),
  generateQuestions: () => Promise.reject(new Error("デモモードでは生成ジョブ（擬似処理）を使います")),
  getQuestionHistory: () => Promise.resolve([]),
  renderQuizCard: () => Promise.reject(new Error("デモでは画像を作れません")),
  importQuestions: () => Promise.reject(new Error("デモモードでは正本に登録しません")),
  listInsights: () => Promise.resolve([]),
  recordManualPost: () => Promise.reject(new Error("デモモードでは手動投稿を正本に記録しません")),
  recordResponses: () => Promise.reject(new Error("デモモードでは結果を正本に記録しません")),
  getMe: () => Promise.reject(new Error("デモモードではログインを使いません")),
  requestRole: () => Promise.reject(new Error("デモモードでは権限を申請できません")),
  listUsers: () => Promise.resolve([]),
  setUserRole: () => Promise.reject(new Error("デモモードでは正本の権限を変えません")),
  rejectRoleRequest: () => Promise.reject(new Error("デモモードでは正本の権限を変えません")),
}
