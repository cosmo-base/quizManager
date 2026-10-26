"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlatformMark } from "@/components/shared/platform-badge"
import { SimpleSelect } from "@/components/shared/simple-select"
import { useQuiz } from "@/lib/store/quiz-store"
import { checkReuse, describeConflict } from "@/lib/validation"
import { DEMO_TODAY, formatDate } from "@/lib/format"
import type { ChoiceLabel, Question } from "@/lib/types"
import { cn } from "@/lib/utils"

export function EditQuestionDialog({ q, open, onOpenChange }: { q: Question; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { actions } = useQuiz()
  const [text, setText] = useState(q.text)
  const [choices, setChoices] = useState(q.choices.map((c) => c.text))
  const [answer, setAnswer] = useState<ChoiceLabel>(q.answer)
  const [explanation, setExplanation] = useState(q.explanation)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || choices.some((c) => !c.trim()) || !explanation.trim()) return setError("問題文・選択肢・解説は必須です")
    if (new Set(choices.map((c) => c.trim())).size !== choices.length) return setError("選択肢が重複しています")
    if (!note.trim()) return setError("変更理由を入力してください")
    if (actions.editQuestion(q.id, { text: text.trim(), choices: choices.map((c) => c.trim()), answer, explanation: explanation.trim() }, note.trim())) {
      onOpenChange(false)
      setNote("")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>問題を編集（{q.id}）</DialogTitle>
            <DialogDescription>保存すると新しいバージョンが作成され、再検証が必要になります。予約済みの場合は予約が解除されます。</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-text">問題文</Label>
            <Textarea id="e-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">選択肢と正解</legend>
            {q.choices.map((c, i) => (
              <div key={c.label} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnswer(c.label)}
                  aria-pressed={answer === c.label}
                  aria-label={`${c.label}を正解にする`}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold",
                    answer === c.label ? "border-success bg-success text-success-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
                <Input
                  aria-label={`選択肢${c.label}`}
                  value={choices[i]}
                  onChange={(e) => setChoices((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </div>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-exp">解説</Label>
            <Textarea id="e-exp" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-note">変更理由</Label>
            <Input id="e-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：選択肢Bの表記を修正" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit">保存して新バージョンを作成</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 出題計画への登録。reuse=true のときは再出題可能日以降の枠だけを対象にする */
export function AssignToPlanDialog({
  q,
  open,
  onOpenChange,
  reuseFrom,
}: {
  q: Question
  open: boolean
  onOpenChange: (o: boolean) => void
  reuseFrom?: string | null
}) {
  const { state, data, actions } = useQuiz()
  const minDate = reuseFrom && reuseFrom > DEMO_TODAY ? reuseFrom : DEMO_TODAY
  const slots = data.slots
    .filter((s) => !s.questionId && s.date >= minDate && (reuseFrom !== undefined || s.platform === q.platform))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 40)
  const [slotId, setSlotId] = useState<string>("")
  const selected = slots.find((s) => s.id === slotId)
  const reuse = selected ? checkReuse(q, selected.platform, selected.date, data.questions, state.settings.rules) : null

  const submit = () => {
    if (selected && actions.assignQuestion(selected.id, q.id)) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reuseFrom !== undefined ? "再出題候補として枠に登録" : "出題計画へ登録"}</DialogTitle>
          <DialogDescription>
            {reuseFrom !== undefined
              ? `再出題可能日（${minDate}）以降の空き枠に割り当てます。`
              : "同じ媒体の空き枠を選んで、この問題を割り当てます。"}
          </DialogDescription>
        </DialogHeader>
        {slots.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">割り当て可能な空き枠がありません。カレンダーで枠を作成してください。</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-slot">出題枠</Label>
              <SimpleSelect
                id="a-slot"
                value={slotId}
                onChange={setSlotId}
                placeholder="枠を選択"
                options={slots.map((s) => ({ value: s.id, label: `${formatDate(s.date)} ${s.time}（${s.theme || "題材未定"}）` }))}
              />
            </div>
            {selected && (
              <div className="flex items-center gap-2 text-sm">
                <PlatformMark platform={selected.platform} />
                <span className="tabular-nums">
                  {selected.date} {selected.time}
                </span>
              </div>
            )}
            {reuse && !reuse.ok && (
              <ul role="alert" className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                {reuse.conflicts.map((c) => (
                  <li key={c.questionId}>{describeConflict(c)}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={!selected || (reuse != null && !reuse.ok)}>
            登録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
