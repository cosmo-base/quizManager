// Discord 出題の書式。GAS 側（QuizFormat.gs）と同じ規則にそろえること。
// - 毎朝 2 通：前日の正解（前日の問題への返信・正解カードの画像付き）→ 当日の問題（問題カードの画像付き）
// - 問題：【今日の宇宙クイズ】前振り／そこで今日はこんな問題です。／問題文／①②③／案内／X でも出題中
// - Bot が 1️⃣2️⃣3️⃣ のリアクションを付け、参加者はリアクションで回答する（Bot 自身の分は数えない）
// - 複数の番号を選んだ人は無効。翌朝 06:00 の正解発表の直前に締め切って集計する
// - 正解：【前回の回答】正解は||「③〜」||です！（ネタバレ防止）＋解説
import type { ChoiceLabel, Question } from "@/lib/types"
import { CIRCLED_NUMBER } from "@/lib/x-poll"

/** Discord のメッセージの上限（公式仕様） */
export const DISCORD_MESSAGE_MAX = 2000
export const DISCORD_EMOJI: Record<ChoiceLabel, string> = { A: "1️⃣", B: "2️⃣", C: "3️⃣" }
export const DISCORD_CLOSE_NOTE = "下のリアクションから選んで回答してみてください！"
export const DISCORD_FOOTER = "Xでも出題中。是非挑戦してみてください！"

const LABELS: ChoiceLabel[] = ["A", "B", "C"]
const choiceText = (q: Pick<Question, "choices">, label: ChoiceLabel) => q.choices.find((c) => c.label === label)?.text ?? ""

export function buildDiscordQuestionText(q: Pick<Question, "text" | "choices" | "lead">): string {
  const lead = (q.lead ?? "").trim()
  return [
    "【今日の宇宙クイズ】",
    "",
    ...(lead ? [lead, "", "そこで今日はこんな問題です。", ""] : []),
    q.text.trim(),
    "",
    ...LABELS.map((l) => `${CIRCLED_NUMBER[l]} ${choiceText(q, l)}`),
    "",
    DISCORD_CLOSE_NOTE,
    "",
    DISCORD_FOOTER,
  ].join("\n")
}

export function buildDiscordAnswerText(q: Pick<Question, "answer" | "choices" | "explanation">): string {
  return ["【前回の回答】", "", `正解は||「${CIRCLED_NUMBER[q.answer]}${choiceText(q, q.answer)}」||です！`, "", q.explanation.trim()].join("\n")
}

/** 出題・正解発表のどちらかが上限を超えるなら、その文字数（超えなければ null） */
export function overlongDiscordText(q: Pick<Question, "text" | "choices" | "answer" | "explanation" | "lead">): number | null {
  const n = Math.max(buildDiscordQuestionText(q).length, buildDiscordAnswerText(q).length)
  return n > DISCORD_MESSAGE_MAX ? n : null
}
