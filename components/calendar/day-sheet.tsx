"use client"

import Link from "next/link"
import { useState } from "react"
import { Copy, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import { addDays, DEMO_TODAY, formatDate } from "@/lib/format"
import { DIFFICULTY_LABEL, PLAN_STATUS, PLATFORM_LABEL, QUESTION_STATUS, TIMELINESS_LABEL } from "@/lib/constants"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { SimpleSelect } from "@/components/shared/simple-select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PermissionNote } from "@/components/shared/states"
import type { Platform, PlanSlot } from "@/lib/types"
import { CAL_PLATFORMS } from "./calendar-views"
import { LOCKED_STATUSES } from "./slot-chip"
import { DEFAULT_SLOT_DRAFT, SlotFields, type SlotDraft } from "./slot-fields"
import { questionHref } from "@/lib/routes"

function SlotEditor({ date, platform, slot, onDone }: { date: string; platform: Platform; slot?: PlanSlot; onDone: () => void }) {
  const { actions } = useQuiz()
  const [draft, setDraft] = useState<SlotDraft>(() => (slot ? { ...slot } : { ...DEFAULT_SLOT_DRAFT }))
  return (
    <form
      className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        const ok = actions.upsertSlot({
          ...(slot ?? { id: `SL-${date}-${platform}`, date, platform, status: "waiting" as const, questionId: null }),
          ...draft,
          source: "manual",
        })
        if (ok) onDone()
      }}
    >
      <SlotFields value={draft} onChange={setDraft} idPrefix={`ed-${date}-${platform}`} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          キャンセル
        </Button>
        <Button type="submit">保存</Button>
      </div>
    </form>
  )
}

function SlotCard({ date, platform, slot }: { date: string; platform: Platform; slot?: PlanSlot }) {
  const { data, actions, can, state } = useQuiz()
  const categoryName = useCategoryName()
  const [editing, setEditing] = useState(false)
  const [assignId, setAssignId] = useState("")
  const locked = slot ? LOCKED_STATUSES.includes(slot.status as (typeof LOCKED_STATUSES)[number]) : false
  const editable = can("plan") && !locked && date >= DEMO_TODAY
  const q = slot ? data.questions.find((x) => x.id === slot.questionId) : undefined
  const candidates = data.questions.filter((x) => x.platform === platform && x.status === "approved" && !x.plannedDate)

  return (
    <section aria-label={`${PLATFORM_LABEL[platform]}の出題枠`} className="flex flex-col gap-3 rounded-lg border p-4">
      <header className="flex items-center gap-2">
        <PlatformBadge platform={platform} />
        {slot ? <StatusBadge {...PLAN_STATUS[slot.status]} /> : <StatusBadge {...PLAN_STATUS.unset} />}
        {slot && <span className="ml-auto font-mono text-sm tabular-nums text-muted-foreground">{slot.time}</span>}
      </header>

      {editing ? (
        <SlotEditor date={date} platform={platform} slot={slot} onDone={() => setEditing(false)} />
      ) : slot ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ["カテゴリ", categoryName(slot.categoryId)],
              ["難易度", DIFFICULTY_LABEL[slot.difficulty]],
              ["時事性", TIMELINESS_LABEL[slot.timeliness]],
              ["生成", slot.generation === "auto" ? "自動" : "手動"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {(slot.theme || slot.instructions) && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {slot.theme && <>テーマ：{slot.theme}　</>}
              {slot.instructions && <>指示：{slot.instructions}</>}
            </p>
          )}
          {q ? (
            <Link href={questionHref(q.id)} className="flex flex-col gap-1 rounded-md border px-3 py-2 hover:bg-accent">
              <span className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{q.id}</span>
                <StatusBadge {...QUESTION_STATUS[q.status]} />
              </span>
              <span className="line-clamp-2 text-sm leading-relaxed">{q.text}</span>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">問題はまだ割り当てられていません</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">出題枠が設定されていません</p>
      )}

      {!editing && editable && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {slot ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
              {slot ? "条件を編集" : "出題枠を追加"}
            </Button>
            {slot && !slot.questionId && (
              <Button size="sm" variant="outline" render={<Link href={`/generate?mode=single&date=${date}&platform=${platform}`} />}>
                <Sparkles className="size-3.5" aria-hidden />
                AIで生成
              </Button>
            )}
            {slot?.questionId && can("generate") && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <RefreshCw className="size-3.5" aria-hidden />
                    再生成
                  </Button>
                }
                title="この問題を再生成しますか？"
                description="現在の問題は差し替え対象となり、新しい候補が確認待ちに追加されます。"
                target={slot.questionId}
                confirmLabel="再生成する"
                onConfirm={() => actions.regenerateQuestion(slot.questionId!)}
              />
            )}
            {slot && (
              <Button size="sm" variant="outline" onClick={() => actions.copySlotTo(slot.id, [addDays(date, 7)])}>
                <Copy className="size-3.5" aria-hidden />
                翌週同曜日へ複製
              </Button>
            )}
            {slot && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden />
                    取消
                  </Button>
                }
                title="出題予定を取り消しますか？"
                description="予約済みの投稿も取り消され、割当済みの問題は未割当の確定問題に戻ります。"
                target={`${formatDate(date, { weekday: true })} ${PLATFORM_LABEL[platform]}`}
                confirmLabel="取り消す"
                destructive
                onConfirm={() => actions.cancelSlot(slot.id)}
              />
            )}
          </div>
          {slot && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">確定済みの既存問題を割り当てる（{candidates.length}問）</span>
              <div className="flex gap-2">
                <SimpleSelect
                  aria-label="割り当てる問題"
                  size="sm"
                  value={assignId}
                  onChange={setAssignId}
                  placeholder={candidates.length ? "問題を選択" : "割当可能な問題がありません"}
                  disabled={!candidates.length}
                  options={candidates.map((c) => ({ value: c.id, label: `${c.id}　${c.text.slice(0, 28)}…` }))}
                />
                <Button size="sm" disabled={!assignId} onClick={() => actions.assignQuestion(slot.id, assignId) && setAssignId("")}>
                  割当
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {!editing && !can("plan") && <PermissionNote role={state.role} need="出題計画を変更" />}
      {!editing && locked && <p className="text-xs text-muted-foreground">投稿処理済みの枠は変更できません</p>}
    </section>
  )
}

export function DaySheet({ date, onOpenChange }: { date: string | null; onOpenChange: (o: boolean) => void }) {
  const { data } = useQuiz()
  return (
    <Sheet open={!!date} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {date && (
          <>
            <SheetHeader>
              <SheetTitle>{formatDate(date, { weekday: true, year: true })}</SheetTitle>
              <SheetDescription>
                {date < DEMO_TODAY ? "過去の出題記録です" : date === DEMO_TODAY ? "本日の出題予定です。当日枠は移動できません" : "出題条件の確認・変更ができます"}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-6">
              {CAL_PLATFORMS.map((p) => (
                <SlotCard key={`${date}-${p}`} date={date} platform={p} slot={data.slots.find((s) => s.date === date && s.platform === p)} />
              ))}
              <p className="text-xs leading-relaxed text-muted-foreground">Instagramは日付指定の出題枠を持たず、確定問題のストックから手動で投稿します。</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
