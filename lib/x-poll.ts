// X 投稿の書式と投票結果の変換。GAS 側（QuizFormat.gs）と同じ規則にそろえること。
// - 画像なし。問題文＋標準投票（選択肢「1」「2」「3」）の 1 投稿。選択肢の中身は本文に書く
// - 回答・解説は問題投稿へのリプライ
import type { ChoiceLabel, Question, ResponseSnapshot } from "@/lib/types"

/** 06:00 投稿・翌 05:50 締切（24時間＝1440分だと翌 06:00 締切になり合わない） */
export const X_POLL_DURATION_MINUTES = 1430

export const CHOICE_TO_POLL_OPTION: Record<ChoiceLabel, string> = { A: "1", B: "2", C: "3" }
export const POLL_OPTION_TO_CHOICE: Record<string, ChoiceLabel> = { "1": "A", "2": "B", "3": "C" }
export const X_POLL_OPTIONS = Object.values(CHOICE_TO_POLL_OPTION)

/** X API の poll オブジェクト（GET /2/tweets/:id の includes.polls[]） */
export interface XPoll {
  id: string
  options: { position: number; label: string; votes: number }[]
  voting_status?: "open" | "closed"
  end_datetime?: string
  duration_minutes?: number
}

export function buildXQuestionText(q: Pick<Question, "text" | "choices">): string {
  return [q.text, "", ...q.choices.map((c) => `${CHOICE_TO_POLL_OPTION[c.label]}. ${c.text}`)].join("\n")
}

export function buildXAnswerText(q: Pick<Question, "answer" | "choices" | "explanation">): string {
  const correct = q.choices.find((c) => c.label === q.answer)
  return [`【正解】${CHOICE_TO_POLL_OPTION[q.answer]}. ${correct?.text ?? ""}`, "", q.explanation].join("\n")
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
      const label = POLL_OPTION_TO_CHOICE[o.label]
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
