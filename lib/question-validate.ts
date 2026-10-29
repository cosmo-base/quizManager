// 問題を正本に保存する前の入力チェック（問題の作成・編集と、Excel からの取り込みで共通）。
// GAS 側（Questions.js の validateQuestion_）でも同じ確認をする。
import type { ChoiceLabel, Platform } from "@/lib/types"
import { DISCORD_MESSAGE_MAX, overlongDiscordText } from "@/lib/discord-format"
import { X_POLL_OPTION_MAX, xPollOption } from "@/lib/x-poll"

/** 題材（「木星」など）の文字数の上限。GAS の QUESTION_TOPIC_MAX と同じ */
export const TOPIC_MAX = 20
/** 前振り・画像用の短い解説の文字数の上限。GAS の QUESTION_LEAD_MAX・CARD_SUMMARY_MAX と同じ */
export const LEAD_MAX = 300
export const CARD_SUMMARY_MAX = 150

export const CHOICE_LABELS: ChoiceLabel[] = ["A", "B", "C"]
export const URL_PATTERN = /(https?:\/\/|www\.)|\b[a-z0-9][a-z0-9-]*\.(com|net|org|jp|io|co|me|ly|gl|ai|dev|app|info|biz|tv|link)\b/i

export interface QuestionFields {
  text: string
  /** A・B・C の順 */
  choices: string[]
  answer: ChoiceLabel
  explanation: string
  /** 前振り（問題文の前の背景） */
  lead?: string
  /** 画像（正解カード）用の短い解説 */
  cardSummary?: string
}

/** 問題がなければ null、あれば理由 */
export function questionError(f: QuestionFields, platform: Exclude<Platform, "instagram">): string | null {
  if (!f.text.trim() || f.choices.some((c) => !c.trim()) || !f.explanation.trim()) return "問題文・選択肢・解説は必須です"
  const lead = f.lead ?? ""
  const cardSummary = f.cardSummary ?? ""
  if (lead.length > LEAD_MAX) return `前振りは ${LEAD_MAX} 文字までです`
  if (cardSummary.length > CARD_SUMMARY_MAX) return `画像用の短い解説は ${CARD_SUMMARY_MAX} 文字までです`
  if (new Set(f.choices.map((c) => c.trim())).size !== f.choices.length) return "選択肢が重複しています"
  if (platform === "x") {
    const tooLong = CHOICE_LABELS.filter((l, i) => xPollOption(l, f.choices[i]).length > X_POLL_OPTION_MAX)
    if (tooLong.length) return `選択肢 ${tooLong.join("・")} が長すぎます（X の投票は番号込みで ${X_POLL_OPTION_MAX} 文字まで）`
  } else {
    const n = overlongDiscordText({ text: f.text, choices: CHOICE_LABELS.map((label, i) => ({ label, text: f.choices[i] })), answer: f.answer, explanation: f.explanation, lead })
    if (n !== null) return `Discord のメッセージが ${n} 文字あります（${DISCORD_MESSAGE_MAX} 文字まで）`
  }
  if ([f.text, f.explanation, lead, cardSummary, ...f.choices].some((v) => URL_PATTERN.test(v))) return "投稿本文には URL を入れられません"
  return null
}

/** 重複を見つけるための問題文の正規化（全角・半角、空白、句読点の揺れをそろえる） */
export function normalizeQuestionText(s: string): string {
  return s.normalize("NFKC").replace(/[\s　、。,.!?！？「」『』()（）]/g, "").toLowerCase()
}
