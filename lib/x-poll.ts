// X 投稿の書式と投票結果の変換。GAS 側（QuizFormat.gs）と同じ規則にそろえること。
// - 問題：【今日の宇宙クイズ】＋前振りと問題文＋案内＋ハッシュタグ。選択肢は投票に「①土星」の形で入れる（上から ①②③）
// - 投票の選択肢は 1 つ 25 文字まで（番号「①」を含む）
// - 問題の直後に、コミュニティーへの誘導をスレッド返信で付ける（URL はこの招待リンクだけ）
// - 翌朝の正解：前日の問題を引用リポストする
// - 投票結果は文言ではなく順番（position 1〜3）で A・B・C に対応させる
import type { ChoiceLabel, Question, ResponseSnapshot } from "@/lib/types"

/** 06:00 投稿・翌 05:50 締切（24時間＝1440分だと翌 06:00 締切になり合わない） */
export const X_POLL_DURATION_MINUTES = 1430
/** X の投票の選択肢の上限（公式仕様） */
export const X_POLL_OPTION_MAX = 25

const LABELS: ChoiceLabel[] = ["A", "B", "C"]
export const CHOICE_NUMBER: Record<ChoiceLabel, number> = { A: 1, B: 2, C: 3 }
export const CIRCLED_NUMBER: Record<ChoiceLabel, string> = { A: "①", B: "②", C: "③" }
export const X_HASHTAG = "#毎日宇宙クイズ"
/** 投稿に入れてよい唯一の URL（X のコミュニティー返信だけで使う） */
export const COMMUNITY_INVITE_URL = "https://discord.com/invite/xVJDjuGyeM"
export const X_COMMUNITY_TEXT = `宇宙がより身近になるコミュニティー「Cosmo Base」を運営中\n\nコミュニティーの参加はこちら\n${COMMUNITY_INVITE_URL}`

/** X API の poll オブジェクト（GET /2/tweets/:id の includes.polls[]） */
export interface XPoll {
  id: string
  options: { position: number; label: string; votes: number }[]
  voting_status?: "open" | "closed"
  end_datetime?: string
  duration_minutes?: number
}

/** 投票の選択肢 1 つ分（例："2. 木星"） */
export function xPollOption(label: ChoiceLabel, text: string): string {
  return `${CIRCLED_NUMBER[label]}${text.trim()}`
}

/** 投票の選択肢（A・B・C の順に 1・2・3） */
export function buildXPollOptions(q: Pick<Question, "choices">): string[] {
  return LABELS.map((label) => xPollOption(label, q.choices.find((c) => c.label === label)?.text ?? ""))
}

/** 25 文字を超える選択肢のラベル（番号込みで数える） */
export function overlongXChoices(q: Pick<Question, "choices">): ChoiceLabel[] {
  return LABELS.filter((label) => xPollOption(label, q.choices.find((c) => c.label === label)?.text ?? "").length > X_POLL_OPTION_MAX)
}

export function buildXQuestionText(q: Pick<Question, "text" | "lead">): string {
  return ["【今日の宇宙クイズ】", (q.lead ?? "").trim() + q.text.trim(), "", "下の選択肢から、ぜひ答えを予想してみてください！", X_HASHTAG].join("\n")
}

/** 翌朝の正解（前日の問題の引用リポスト） */
export function buildXAnswerText(q: Pick<Question, "answer" | "choices" | "explanation">): string {
  const correct = q.choices.find((c) => c.label === q.answer)
  return ["【前回の回答】", "", `正解は「${xPollOption(q.answer, correct?.text ?? "")}」です！`, "", q.explanation.trim(), "", X_HASHTAG].join("\n")
}

/** 投票結果を回答集計に変換する。票数が取れない場合は null（0 と区別する）。 */
export function pollToResponseSnapshot(
  poll: XPoll | null,
  answer: ChoiceLabel,
  postJobId: string,
  collectedAt: string,
): ResponseSnapshot {
  const perChoice: Record<ChoiceLabel, number | null> = { A: null, B: null, C: null }
  let total: number | null = null
  if (poll) {
    total = 0
    for (const o of poll.options) {
      const label = LABELS[o.position - 1]
      if (label) perChoice[label] = o.votes
      total += o.votes
    }
  }
  return {
    platform: "x",
    postJobId,
    responses: total,
    correct: perChoice[answer],
    perChoice,
    impressions: null,
    clicks: null,
    finalized: poll?.voting_status === "closed",
    collectedAt,
  }
}
