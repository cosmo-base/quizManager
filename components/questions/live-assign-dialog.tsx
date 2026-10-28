"use client"

// 実APIモード：問題の出題日を設定する（出題計画へ登録・再出題）。承認済みのまま出題日を入れた新しい版を保存する。
// 出題日を空にすると予備に戻る。同じ日・同じ媒体にほかの承認済みの問題があれば知らせる（その日は 1 問だけ投稿される）。
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLATFORM_LABEL } from "@/lib/constants"
import { addDays, formatDate } from "@/lib/format"
import { Checkbox } from "@/components/ui/checkbox"
import { useQuiz, useToday } from "@/lib/store/quiz-store"
import type { Question } from "@/lib/types"

export function LiveAssignDateDialog({ q, open, onOpenChange }: { q: Question; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, actions } = useQuiz()
  const today = useToday()
  const min = addDays(today, 1)
  const [date, setDate] = useState(q.plannedDate && q.plannedDate >= min ? q.plannedDate : "")
  const [saving, setSaving] = useState(false)
  const conflicts = date
    ? data.questions.filter((x) => x.id !== q.id && x.platform === q.platform && x.plannedDate === date && x.status === "approved")
    : []
  const posted = data.postJobs.some((j) => j.date === date && j.platform === q.platform && j.status === "posted")
  const tooEarly = !!date && date < min
  // 再出題は基本的にしない：出題済みの問題に日付を入れるときは、確認してから保存する
  const postedBefore = data.postJobs.filter((j) => j.questionId === q.id && (j.status === "posted" || j.status === "unknown")).map((j) => j.date).sort()
  const [confirmRepost, setConfirmRepost] = useState(false)

  const save = async (d: string | null) => {
    setSaving(true)
    const done = await actions.assignLiveDate(q.id, d)
    setSaving(false)
    if (done) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>出題日を設定（{q.id}）</DialogTitle>
          <DialogDescription>
            {PLATFORM_LABEL[q.platform]}に 06:00 に出題します。承認済みのまま、出題日を入れた新しい版を保存します。明日の分は 21:00 に固定されます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-date">出題日</Label>
          <Input id="assign-date" type="date" min={min} value={date} onChange={(e) => setDate(e.target.value)} />
          {tooEarly && <p className="text-xs text-destructive">明日以降の日付を選んでください</p>}
          {posted && <p className="text-xs text-destructive">この日はすでに投稿済みです</p>}
          {postedBefore.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
              <p>
                この問題は {postedBefore.map((d) => formatDate(d)).join("・")} に出題済みです。再出題は基本的にしない方針です。
              </p>
              <label className="flex items-center gap-2">
                <Checkbox checked={confirmRepost} onCheckedChange={(c) => setConfirmRepost(!!c)} />
                それでも再出題する
              </label>
            </div>
          )}
          {conflicts.length > 0 && (
            <p className="text-xs text-warning">
              この日にはすでに {conflicts.map((c) => c.id).join("・")} が承認済みで入っています。1 日 1 問にするため、どちらかを予備に戻してください。
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {q.plannedDate && q.plannedDate >= min ? (
            <Button variant="ghost" disabled={saving} onClick={() => save(null)}>
              予備に戻す
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button disabled={saving || !date || tooEarly || posted || (postedBefore.length > 0 && !confirmRepost)} onClick={() => save(date)}>
              {saving ? "保存中…" : "この日に出題"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
