"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SimpleSelect } from "@/components/shared/simple-select"
import { useQuiz } from "@/lib/store/quiz-store"
import { DIFFICULTY_LABEL, FORMAT_LABEL, TIMELINESS_LABEL } from "@/lib/constants"
import type { Difficulty, PlanSlot, QuestionFormat, Timeliness } from "@/lib/types"

export type SlotDraft = Pick<PlanSlot, "categoryId" | "difficulty" | "theme" | "format" | "timeliness" | "time" | "instructions" | "generation" | "priority">

export const DEFAULT_SLOT_DRAFT: SlotDraft = {
  categoryId: "auto",
  difficulty: "auto",
  theme: "",
  format: "auto",
  timeliness: "auto",
  time: "06:00",
  instructions: "",
  generation: "auto",
  priority: "normal",
}

const opts = <T extends string>(rec: Record<T, string>) => (Object.keys(rec) as T[]).map((k) => ({ value: k, label: rec[k] }))

export function SlotFields({ value, onChange, idPrefix, minimal }: { value: SlotDraft; onChange: (v: SlotDraft) => void; idPrefix: string; minimal?: boolean }) {
  const { data } = useQuiz()
  const set = <K extends keyof SlotDraft>(k: K, v: SlotDraft[K]) => onChange({ ...value, [k]: v })
  const categoryOptions = [{ value: "auto", label: "自動（AIが選択）" }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-cat`}>カテゴリ</Label>
        <SimpleSelect id={`${idPrefix}-cat`} value={value.categoryId} onChange={(v) => set("categoryId", v)} options={categoryOptions} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-diff`}>難易度</Label>
        <SimpleSelect<Difficulty> id={`${idPrefix}-diff`} value={value.difficulty} onChange={(v) => set("difficulty", v)} options={opts(DIFFICULTY_LABEL)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-time`}>時事性</Label>
        <SimpleSelect<Timeliness> id={`${idPrefix}-time`} value={value.timeliness} onChange={(v) => set("timeliness", v)} options={opts(TIMELINESS_LABEL)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-at`}>投稿時刻（JST）</Label>
        <Input id={`${idPrefix}-at`} type="time" value={value.time} onChange={(e) => set("time", e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-gen`}>生成方法</Label>
        <SimpleSelect id={`${idPrefix}-gen`} value={value.generation} onChange={(v) => set("generation", v)} options={[{ value: "auto", label: "自動生成" }, { value: "manual", label: "手動作成" }]} />
      </div>
      {!minimal && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-fmt`}>出題形式</Label>
            <SimpleSelect<QuestionFormat> id={`${idPrefix}-fmt`} value={value.format} onChange={(v) => set("format", v)} options={opts(FORMAT_LABEL)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-pri`}>優先度</Label>
            <SimpleSelect id={`${idPrefix}-pri`} value={value.priority} onChange={(v) => set("priority", v)} options={[{ value: "normal", label: "通常" }, { value: "high", label: "高（優先して生成）" }]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-theme`}>テーマ（任意）</Label>
            <Input id={`${idPrefix}-theme`} value={value.theme} placeholder="例：アルテミス計画" onChange={(e) => set("theme", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-ins`}>AIへの追加指示（任意）</Label>
            <Textarea id={`${idPrefix}-ins`} rows={3} value={value.instructions} placeholder="例：初心者でも解けるように、数値問題は避ける" onChange={(e) => set("instructions", e.target.value)} />
          </div>
        </>
      )}
    </div>
  )
}
