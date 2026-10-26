"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SimpleSelect } from "@/components/shared/simple-select"
import { PlatformMark } from "@/components/shared/platform-badge"
import { useQuiz } from "@/lib/store/quiz-store"
import { DIFFICULTY_LABEL, PLATFORM_LABEL, TIMELINESS_LABEL, WEEKDAY_LABEL } from "@/lib/constants"
import { addDays, DEMO_TODAY, endOfMonth, formatDate } from "@/lib/format"
import type { Difficulty, Platform, Timeliness } from "@/lib/types"
import { CAL_PLATFORMS } from "./calendar-views"
import { DEFAULT_SLOT_DRAFT, SlotFields, type SlotDraft } from "./slot-fields"

const opts = <T extends string>(rec: Record<T, string>) => (Object.keys(rec) as T[]).map((k) => ({ value: k, label: rec[k] }))

export function BulkSetDialog({ open, onOpenChange, dates, onApplied }: { open: boolean; onOpenChange: (o: boolean) => void; dates: string[]; onApplied: () => void }) {
  const { actions } = useQuiz()
  const [platforms, setPlatforms] = useState<Platform[]>(CAL_PLATFORMS)
  const [draft, setDraft] = useState<SlotDraft>({ ...DEFAULT_SLOT_DRAFT })
  const sorted = [...dates].sort()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>選択日に出題条件を一括設定</DialogTitle>
          <DialogDescription>
            {sorted.length}日（{formatDate(sorted[0])}〜{formatDate(sorted.at(-1))}）が対象です。問題割当済み・予約済みの枠は上書きしません。
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">対象媒体</legend>
          <div className="flex gap-4">
            {CAL_PLATFORMS.map((p) => (
              <Label key={p} className="flex items-center gap-2 font-normal">
                <Checkbox checked={platforms.includes(p)} onCheckedChange={(c) => setPlatforms((prev) => (c ? [...prev, p] : prev.filter((x) => x !== p)))} />
                <PlatformMark platform={p} />
                {PLATFORM_LABEL[p]}
              </Label>
            ))}
          </div>
        </fieldset>
        <SlotFields value={draft} onChange={setDraft} idPrefix="bulk" minimal />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={!platforms.length || !sorted.length}
            onClick={() => {
              actions.bulkSetSlots(sorted, platforms, draft)
              onOpenChange(false)
              onApplied()
            }}
          >
            {sorted.length * platforms.length}枠に適用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TemplateDialog({ open, onOpenChange, anchor }: { open: boolean; onOpenChange: (o: boolean) => void; anchor: string }) {
  const { data, actions, can } = useQuiz()
  const [from, setFrom] = useState(addDays(DEMO_TODAY, 1))
  const [to, setTo] = useState(endOfMonth(addDays(anchor, 31)))
  const categoryOptions = [{ value: "auto", label: "自動" }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]
  const disabled = !can("plan")
  const invalidRange = !from || !to || from > to || from <= DEMO_TODAY

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>週間テンプレート</DialogTitle>
          <DialogDescription>曜日ごとの標準条件です。適用すると、個別指定・確定済みの枠を除いて出題枠を作成・更新します。</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <caption className="sr-only">曜日・媒体別の標準出題条件</caption>
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {["曜日", "媒体", "有効", "カテゴリ", "難易度", "時事性", "時刻"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 text-left font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[1, 2, 3, 4, 5, 6, 0].flatMap((wd) =>
                CAL_PLATFORMS.map((p, i) => {
                  const row = data.weeklyTemplate.find((r) => r.weekday === wd && r.platform === p)
                  if (!row) return null
                  const label = `${WEEKDAY_LABEL[wd]}曜 ${PLATFORM_LABEL[p]}`
                  return (
                    <tr key={`${wd}-${p}`} className={row.enabled ? "" : "text-muted-foreground"}>
                      {i === 0 && (
                        <th scope="rowgroup" rowSpan={CAL_PLATFORMS.length} className="w-12 px-2 py-1.5 text-left font-medium text-foreground">
                          {WEEKDAY_LABEL[wd]}
                        </th>
                      )}
                      <td className="px-2 py-1.5"><PlatformMark platform={p} /></td>
                      <td className="px-2 py-1.5">
                        <Switch aria-label={`${label}を有効化`} checked={row.enabled} disabled={disabled} onCheckedChange={(v) => actions.updateTemplateRow(wd, p, { enabled: v })} />
                      </td>
                      <td className="min-w-36 px-2 py-1.5">
                        <SimpleSelect aria-label={`${label}のカテゴリ`} size="sm" value={row.categoryId} disabled={disabled || !row.enabled} options={categoryOptions} onChange={(v) => actions.updateTemplateRow(wd, p, { categoryId: v })} />
                      </td>
                      <td className="min-w-24 px-2 py-1.5">
                        <SimpleSelect<Difficulty> aria-label={`${label}の難易度`} size="sm" value={row.difficulty} disabled={disabled || !row.enabled} options={opts(DIFFICULTY_LABEL)} onChange={(v) => actions.updateTemplateRow(wd, p, { difficulty: v })} />
                      </td>
                      <td className="min-w-28 px-2 py-1.5">
                        <SimpleSelect<Timeliness> aria-label={`${label}の時事性`} size="sm" value={row.timeliness} disabled={disabled || !row.enabled} options={opts(TIMELINESS_LABEL)} onChange={(v) => actions.updateTemplateRow(wd, p, { timeliness: v })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`${label}の時刻`} type="time" className="h-8 w-28" value={row.time} disabled={disabled || !row.enabled} onChange={(e) => actions.updateTemplateRow(wd, p, { time: e.target.value })} />
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-from">適用開始日</Label>
            <Input id="tpl-from" type="date" min={addDays(DEMO_TODAY, 1)} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-to">適用終了日</Label>
            <Input id="tpl-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground sm:flex-1">{invalidRange ? "開始日は翌日以降、終了日は開始日以降にしてください" : "当日以前の枠は変更しません"}</p>
          <Button
            disabled={disabled || invalidRange}
            onClick={() => {
              actions.applyTemplate(from, to)
              onOpenChange(false)
            }}
          >
            この期間に適用
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
