"use client"

// 実APIモード：難易度・分類が未設定の問題に、再検証で出た AI の案を出す。「反映」を押したときだけ新しい版として保存する
// （中身は変わらないので、ファクトチェックの結果は引き継がれる）。
import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DIFFICULTY_LABEL } from "@/lib/constants"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import type { Question } from "@/lib/types"

/** 承認済みなどの問題を保存するには承認の権限が要る（GAS の saveQuestion と同じ） */
const APPROVAL_STATUSES = ["approved", "returned", "rejected"]

export function LiveSuggestion({ q }: { q: Question }) {
  const { actions, can } = useQuiz()
  const categoryName = useCategoryName()
  const [saving, setSaving] = useState(false)
  const s = q.factCheck.suggestion
  const difficulty = q.difficulty === "auto" ? s?.difficulty ?? null : null
  const category = q.categoryId === "" ? s?.category ?? null : null
  if (!difficulty && !category) return null
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
      note: "AI の案（難易度・分類）を反映",
    })
    setSaving(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
      <Sparkles className="size-4 shrink-0 text-info" aria-hidden />
      <p className="min-w-0 flex-1">
        AI の案：
        {[difficulty && `難易度「${DIFFICULTY_LABEL[difficulty]}」`, category && `分類「${categoryName(category)}」`].filter(Boolean).join("・")}
        <span className="ml-2 text-xs text-muted-foreground">再検証のときに Gemini が付けた案です。反映するまで問題は変わりません。</span>
      </p>
      <Button size="sm" onClick={apply} disabled={saving || !allowed}>
        {saving ? "反映中…" : "反映"}
      </Button>
    </div>
  )
}
