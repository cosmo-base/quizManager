// Discord 出題の書式。GAS 側（QuizFormat.gs）と同じ規則にそろえること。
// - 本文は問題文＋「1️⃣ 土星」のように番号の絵文字付きの選択肢（上から 1・2・3）＋締切の案内
// - Bot が 1️⃣2️⃣3️⃣ のリアクションを付け、参加者はリアクションで回答する（Bot 自身の分は数えない）
// - 複数の番号を選んだ人は無効。翌朝 06:00 の正解発表の直前に締め切って集計する
// - 正解・解説は問題メッセージへの返信
import type { ChoiceLabel, Question } from "@/lib/types"

/** Discord のメッセージの上限（公式仕様） */
export const DISCORD_MESSAGE_MAX = 2000
export const DISCORD_EMOJI: Record<ChoiceLabel, string> = { A: "1️⃣", B: "2️⃣", C: "3️⃣" }
export const DISCORD_CLOSE_NOTE = "リアクションで回答してください（締切：明日 06:00 の正解発表まで・複数選んだ回答は無効）"

const LABELS: ChoiceLabel[] = ["A", "B", "C"]
const choiceText = (q: Pick<Question, "choices">, label: ChoiceLabel) => q.choices.find((c) => c.label === label)?.text ?? ""

export function buildDiscordQuestionText(q: Pick<Question, "text" | "choices">): string {
  return [q.text.trim(), "", ...LABELS.map((l) => `${DISCORD_EMOJI[l]} ${choiceText(q, l)}`), "", DISCORD_CLOSE_NOTE].join("\n")
}

export function buildDiscordAnswerText(q: Pick<Question, "answer" | "choices" | "explanation">): string {
  return [`【正解】${DISCORD_EMOJI[q.answer]} ${choiceText(q, q.answer)}`, "", q.explanation.trim()].join("\n")
}

/** 出題・正解発表のどちらかが上限を超えるなら、その文字数（超えなければ null） */
export function overlongDiscordText(q: Pick<Question, "text" | "choices" | "answer" | "explanation">): number | null {
  const n = Math.max(buildDiscordQuestionText(q).length, buildDiscordAnswerText(q).length)
  return n > DISCORD_MESSAGE_MAX ? n : null
}
