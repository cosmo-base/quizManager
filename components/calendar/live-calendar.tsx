"use client"

// 実APIモードの出題計画：出題日が入った問題と投稿の記録を、日付×媒体のカレンダーに並べる。
// 空いている日（明日以降）には予備問題（承認済み・出題日なし）を割り当てられる。保存は出題日を変えた新しい版（承認の権限が要る）。
import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PlatformBadge, PlatformMark } from "@/components/shared/platform-badge"
import { SimpleSelect } from "@/components/shared/simple-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { PLATFORM_LABEL, POST_STATUS, WEEKDAY_LABEL, type Tone } from "@/lib/constants"
import { addDays, addMonths, dateRange, endOfMonth, formatDate, startOfMonth, startOfWeek, weekday } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import { useQuiz, useToday } from "@/lib/store/quiz-store"
import type { Platform, PostJob, Question } from "@/lib/types"
import { cn } from "@/lib/utils"

type LivePlatform = Exclude<Platform, "instagram">
type Kind = "posted" | "problem" | "scheduled" | "conflict" | "pending" | "empty" | "none"

interface Entry {
  kind: Kind
  job?: PostJob
  questions: Question[]
}

const KIND_STYLE: Record<Exclude<Kind, "none">, { tone: Tone; label: string; cls: string }> = {
  posted: { tone: "success", label: "投稿済み", cls: "border-success/40 bg-success/10 text-success" },
  problem: { tone: "danger", label: "要確認", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  scheduled: { tone: "info", label: "予約済み", cls: "border-primary/40 bg-primary/10 text-primary" },
  conflict: { tone: "danger", label: "承認済みが複数", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  pending: { tone: "warning", label: "未承認", cls: "border-warning/40 bg-warning/10 text-warning" },
  empty: { tone: "muted", label: "空き", cls: "border-dashed text-muted-foreground" },
}

function useEntries(platforms: LivePlatform[], today: string) {
  const { data } = useQuiz()
  return useMemo(() => {
    const jobs = new Map<string, PostJob>()
    data.postJobs.forEach((j) => {
      if (j.status !== "scheduled" && j.status !== "cancelled") jobs.set(`${j.date}:${j.platform}`, j)
    })
    const planned = new Map<string, Question[]>()
    data.questions.forEach((q) => {
      if (!q.plannedDate || q.platform === "instagram" || q.status === "rejected" || q.status === "archived") return
      const key = `${q.plannedDate}:${q.platform}`
      planned.set(key, [...(planned.get(key) ?? []), q])
    })
    return (date: string, p: LivePlatform): Entry => {
      const key = `${date}:${p}`
      const job = jobs.get(key)
      const qs = planned.get(key) ?? []
      if (job) return { kind: job.status === "posted" ? "posted" : "problem", job, questions: qs }
      const approved = qs.filter((q) => q.status === "approved" || q.status === "scheduled")
      if (approved.length > 1) return { kind: "conflict", questions: qs }
      if (approved.length === 1) return { kind: "scheduled", questions: qs }
      if (qs.length) return { kind: "pending", questions: qs }
      return { kind: date > today ? "empty" : "none", questions: [] }
    }
    // platforms は表示する媒体（Discord の設定）が変わったときに作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.postJobs, data.questions, today, platforms.join(",")])
}

export function LiveCalendar() {
  const { state } = useQuiz()
  const today = useToday()
  const platforms: LivePlatform[] = state.liveStatus.discordConfigured ? ["x", "discord"] : ["x"]
  const [anchor, setAnchor] = useState(today)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const entryOf = useEntries(platforms, today)

  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const days = dateRange(startOfWeek(first), addDays(startOfWeek(last), 6))
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  // 今日から 30 日先までの空きの数（見出しに出す）
  const emptySoon = dateRange(addDays(today, 1), addDays(today, 30)).reduce((n, d) => n + platforms.filter((p) => entryOf(d, p).kind === "empty").length, 0)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="前の月" onClick={() => setAnchor((a) => addMonths(startOfMonth(a), -1))}>
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" size="icon" aria-label="次の月" onClick={() => setAnchor((a) => addMonths(startOfMonth(a), 1))}>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>
            今日
          </Button>
        </div>
        <h2 className="text-lg font-semibold tabular-nums" aria-live="polite">
          {anchor.slice(0, 4)}年{Number(anchor.slice(5, 7))}月
        </h2>
        <p className={cn("ml-auto text-sm", emptySoon ? "text-warning" : "text-success")}>{emptySoon ? `30 日先までに空きが ${emptySoon} 枠あります` : "30 日先まで埋まっています"}</p>
      </div>

      <div role="grid" aria-label={`${anchor.slice(0, 4)}年${Number(anchor.slice(5, 7))}月の出題計画`} className="overflow-hidden rounded-lg border">
        <div role="row" className="grid grid-cols-7 border-b bg-muted/60">
          {WEEKDAY_LABEL.map((w, i) => (
            <div key={w} role="columnheader" className={cn("py-1.5 text-center text-xs text-muted-foreground", i === 0 && "text-destructive")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid gap-px bg-border">
          {weeks.map((w) => (
            <div role="row" key={w[0]} className="grid grid-cols-7 gap-px">
              {w.map((d) => {
                const inMonth = d >= first && d <= last
                return (
                  <div key={d} role="gridcell" className={cn("flex min-h-24 flex-col bg-card md:min-h-28", !inMonth && "bg-muted/40")}>
                    <button
                      type="button"
                      onClick={() => setOpenDate(d)}
                      className="flex flex-1 flex-col gap-1 p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      aria-label={`${formatDate(d, { weekday: true })}：${platforms.map((p) => `${PLATFORM_LABEL[p]} ${KIND_STYLE[entryOf(d, p).kind as Exclude<Kind, "none">]?.label ?? "なし"}`).join("、")}`}
                    >
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full font-mono text-xs tabular-nums",
                          d === today && "bg-primary font-semibold text-primary-foreground",
                          d !== today && (d < today || !inMonth) && "text-muted-foreground",
                          weekday(d) === 0 && d !== today && "text-destructive",
                        )}
                      >
                        {Number(d.slice(8))}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        {platforms.map((p) => {
                          const e = entryOf(d, p)
                          if (e.kind === "none") return null
                          const st = KIND_STYLE[e.kind]
                          const qid = e.job?.questionId ?? e.questions[0]?.id
                          return (
                            <span key={p} className={cn("flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[11px]", st.cls)}>
                              <PlatformMark platform={p} className="size-3.5 text-[8px]" />
                              <span className="truncate">{e.kind === "empty" ? "空き" : (qid ?? st.label)}</span>
                            </span>
                          )
                        })}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="凡例">
        {(Object.keys(KIND_STYLE) as Exclude<Kind, "none">[]).map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block size-3 rounded border", KIND_STYLE[k].cls)} aria-hidden />
            {KIND_STYLE[k].label}
          </li>
        ))}
      </ul>

      {openDate && <DayDialog date={openDate} platforms={platforms} entryOf={entryOf} onClose={() => setOpenDate(null)} />}
    </>
  )
}

function DayDialog({ date, platforms, entryOf, onClose }: { date: string; platforms: LivePlatform[]; entryOf: (d: string, p: LivePlatform) => Entry; onClose: () => void }) {
  const { data, state, actions, can } = useQuiz()
  const today = useToday()
  const editable = date > today && can("approve")
  const tomorrowFixed = date === addDays(today, 1) && !!state.liveStatus.automation?.tomorrowPlan

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDate(date, { weekday: true, year: true })}</DialogTitle>
          <DialogDescription>
            {date < today ? "過去の出題記録です。" : date === today ? "今日の出題です（変更できません）。" : can("approve") ? "空いている日には予備問題を割り当てられます。" : "割り当て・変更は承認者・管理者が行います。"}
            {tomorrowFixed && " 明日の分は 21:00 に固定済みのため、変更しても明日は固定した版が投稿されます。"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {platforms.map((p) => (
            <PlatformDay key={p} date={date} platform={p} entry={entryOf(date, p)} editable={editable} spares={data.questions.filter((q) => q.platform === p && q.status === "approved" && !q.plannedDate)} onAssign={actions.assignLiveDate} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PlatformDay({
  date,
  platform,
  entry,
  editable,
  spares,
  onAssign,
}: {
  date: string
  platform: LivePlatform
  entry: Entry
  editable: boolean
  spares: Question[]
  onAssign: (id: string, date: string | null) => Promise<boolean>
}) {
  const [spareId, setSpareId] = useState(spares[0]?.id ?? "")
  const [busy, setBusy] = useState(false)
  const run = async (id: string, d: string | null) => {
    setBusy(true)
    await onAssign(id, d)
    setBusy(false)
  }
  const st = entry.kind === "none" ? null : KIND_STYLE[entry.kind]

  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3" aria-label={`${PLATFORM_LABEL[platform]}の出題`}>
      <div className="flex items-center gap-2">
        <PlatformBadge platform={platform} />
        {entry.job ? <StatusBadge {...POST_STATUS[entry.job.status]} /> : st && <StatusBadge tone={st.tone} label={st.label} />}
      </div>
      {entry.job && (
        <Link href={questionHref(entry.job.questionId)} className="text-sm hover:underline">
          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{entry.job.questionId}</span>
          {entry.questions.find((q) => q.id === entry.job!.questionId)?.text ?? ""}
        </Link>
      )}
      {!entry.job &&
        entry.questions.map((q) => (
          <div key={q.id} className="flex items-start gap-2">
            <Link href={questionHref(q.id)} className="flex-1 text-sm hover:underline">
              <span className="mr-1.5 font-mono text-xs text-muted-foreground">{q.id}</span>
              {q.text}
              {q.status !== "approved" && <span className="ml-1.5 text-xs text-warning">（{q.status === "draft" ? "下書き" : "確認待ち"}）</span>}
            </Link>
            {editable && q.status === "approved" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(q.id, null)} aria-label={`${q.id}を予備に戻す`}>
                <Undo2 aria-hidden />
                予備に戻す
              </Button>
            )}
          </div>
        ))}
      {entry.kind === "none" && <p className="text-sm text-muted-foreground">出題はありません</p>}
      {editable && entry.kind === "empty" && (
        spares.length === 0 ? (
          <p className="text-sm text-muted-foreground">予備問題がありません（出題日を空欄にして承認した問題が予備になります）</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <SimpleSelect
              aria-label={`${PLATFORM_LABEL[platform]}に割り当てる予備問題`}
              className="min-w-0 flex-1"
              value={spareId}
              onChange={setSpareId}
              options={spares.map((q) => ({ value: q.id, label: `${q.id} ${q.text.slice(0, 28)}` }))}
            />
            <Button size="sm" disabled={busy || !spareId} onClick={() => run(spareId, date)}>
              割り当てる
            </Button>
          </div>
        )
      )}
    </section>
  )
}
