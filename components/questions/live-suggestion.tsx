"use client"

// 実APIモード：難易度・分類・題材が未設定の問題に、再検証で出た AI の案を出す。「反映」を押したときだけ新しい版として保存する
// （中身は変わらないので、ファクトチェックの結果は引き継がれる）。
import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DIFFICULTY_LABEL } from "@/lib/constants"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import type { Question } from "@/lib/types"
import Link from "next/link"
import { formatDateTime } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import { findSimilar, SIMILAR_WARN } from "@/lib/similarity"
import { normalizeQuestionText } from "@/lib/question-validate"
import { cn } from "@/lib/utils"

/** 承認済みなどの問題を保存するには承認の権限が要る（GAS の saveQuestion と同じ） */
const APPROVAL_STATUSES = ["approved", "returned", "rejected"]

export function LiveSuggestion({ q }: { q: Question }) {
  const { actions, can } = useQuiz()
  const categoryName = useCategoryName()
  const [saving, setSaving] = useState(false)
  const s = q.factCheck.suggestion
  const difficulty = q.difficulty === "auto" ? s?.difficulty ?? null : null
  const category = q.categoryId === "" ? s?.category ?? null : null
  const topic = !q.topic ? s?.topic ?? null : null
  if (!difficulty && !category && !topic) return null
  const allowed = can(APPROVAL_STATUSES.includes(q.status) ? "approve" : "edit")

  const apply = async () => {
    setSaving(true)
    await actions.saveLiveQuestion({
      id: q.id,
      text: q.text,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      platform: q.platform,
      plannedDate: q.plannedDate,
      status: q.status,
      ...(difficulty ? { difficulty } : {}),
      ...(category ? { category } : {}),
      ...(topic ? { topic } : {}),
      note: "AI の案（難易度・分類・題材）を反映",
    })
    setSaving(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
      <Sparkles className="size-4 shrink-0 text-info" aria-hidden />
      <p className="min-w-0 flex-1">
        AI の案：
        {[difficulty && `難易度「${DIFFICULTY_LABEL[difficulty]}」`, category && `分類「${categoryName(category)}」`, topic && `題材「${topic}」`].filter(Boolean).join("・")}
        <span className="ml-2 text-xs text-muted-foreground">再検証のときに Gemini が付けた案です。反映するまで問題は変わりません。</span>
      </p>
      <Button size="sm" onClick={apply} disabled={saving || !allowed}>
        {saving ? "反映中…" : "反映"}
      </Button>
    </div>
  )
}

/** 差し戻し・不採用の問題に、その理由（最新版のメモ）を目立たせて出す */
export function LiveReturnNotice({ q }: { q: Question }) {
  const last = q.reviewHistory[q.reviewHistory.length - 1]
  if (!last?.note || (q.status !== "returned" && q.status !== "rejected")) return null
  return (
    <div role="note" className="flex flex-col gap-1 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
      <p className="font-medium">{q.status === "returned" ? "差し戻し理由" : "不採用の理由"}</p>
      <p className="whitespace-pre-wrap">{last.note}</p>
      <p className="text-xs text-muted-foreground">
        {last.by} ・ {formatDateTime(last.at)}
      </p>
    </div>
  )
}

/**
 * よく似た問題がほかにあれば知らせる（登録・承認は止めない）。
 * 問題文の近さだけだと「一番大きい／小さい惑星」のような別の問題も出るので、正解も同じなら「同じ問題かも」と強めに出す。
 */
export function SimilarWarning({ text, answerText, exclude, className }: { text: string; answerText?: string; exclude?: string; className?: string }) {
  const { data } = useQuiz()
  const hits = text.trim().length >= 6 ? findSimilar(text, data.questions, { exclude, min: SIMILAR_WARN, limit: 3 }) : []
  if (hits.length === 0) return null
  const sameAnswer = (h: (typeof hits)[number]) => !!answerText?.trim() && normalizeQuestionText(correctText(h.item)) === normalizeQuestionText(answerText)
  const strong = hits.some(sameAnswer)
  return (
    <p className={cn("text-xs", strong ? "text-destructive" : "text-warning", className)}>
      {strong ? "同じ問題の可能性があります（問題文が近く、正解も同じ）：" : "問題文が近い問題があります（別の問題なら問題ありません）："}
      {hits.map((h, i) => (
        <span key={h.item.id}>
          {i > 0 && "、"}
          <Link href={questionHref(h.item.id)} className="underline" target="_blank">
            {h.item.id}
          </Link>
          （近さ {Math.round(h.score * 100)}%{sameAnswer(h) ? "・正解も同じ" : ""}）
        </span>
      ))}
    </p>
  )
}

const correctText = (q: Question) => q.choices.find((c) => c.label === q.answer)?.text ?? ""
