"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import { addDays, dateRange, DEMO_TODAY, endOfMonth, formatDate, startOfMonth, startOfWeek, weekday } from "@/lib/format"
import { DIFFICULTY_LABEL, PLAN_STATUS, TIMELINESS_LABEL, WEEKDAY_LABEL } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Platform, PlanSlot } from "@/lib/types"
import { isSlotMovable, SlotChip } from "./slot-chip"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/states"

export const CAL_PLATFORMS: Platform[] = ["x", "discord"]

interface ViewProps {
  anchor: string
  selectMode: boolean
  selected: Set<string>
  onDayClick: (date: string) => void
}

function useSlotsByDate() {
  const { data } = useQuiz()
  const map = new Map<string, PlanSlot[]>()
  for (const s of data.slots) {
    if (!CAL_PLATFORMS.includes(s.platform)) continue
    const arr = map.get(s.date) ?? []
    arr.push(s)
    map.set(s.date, arr)
  }
  for (const arr of map.values()) arr.sort((a, b) => CAL_PLATFORMS.indexOf(a.platform) - CAL_PLATFORMS.indexOf(b.platform))
  return map
}

function DayCell({ date, inMonth, slots, selectMode, selected, onDayClick, tall }: { date: string; inMonth: boolean; slots: PlanSlot[]; selectMode: boolean; selected: boolean; onDayClick: (d: string) => void; tall?: boolean }) {
  const { actions } = useQuiz()
  const [over, setOver] = useState(false)
  const isToday = date === DEMO_TODAY
  const past = date < DEMO_TODAY
  const dropAllowed = date > DEMO_TODAY

  return (
    <div
      role="gridcell"
      aria-selected={selectMode ? selected : undefined}
      onDragOver={(e) => {
        if (!dropAllowed) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData("text/slot-id")
        if (id) actions.moveSlot(id, date)
      }}
      className={cn(
        "relative flex flex-col bg-card",
        tall ? "min-h-40" : "min-h-24 md:min-h-28",
        !inMonth && "bg-muted/40",
        over && "bg-primary/10 ring-2 ring-inset ring-primary",
        selected && "bg-primary/10",
      )}
    >
      <button
        type="button"
        onClick={() => onDayClick(date)}
        className="flex flex-1 flex-col gap-1 p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`${formatDate(date, { weekday: true })}${slots.length ? `、出題枠${slots.length}件` : "、出題枠なし"}${selectMode ? (selected ? "、選択中" : "、未選択") : ""}`}
      >
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full font-mono text-xs tabular-nums",
              isToday && "bg-primary font-semibold text-primary-foreground",
              !isToday && (past || !inMonth) && "text-muted-foreground",
              weekday(date) === 0 && !isToday && "text-destructive",
            )}
          >
            {Number(date.slice(8))}
          </span>
          {selectMode && (
            <span className={cn("ml-auto flex size-4 items-center justify-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
              {selected && <Check className="size-3" aria-hidden />}
            </span>
          )}
        </span>
        <span className="flex flex-col gap-0.5">
          {slots.map((s) => (
            <SlotChip key={s.id} slot={s} draggable={!selectMode && isSlotMovable(s)} />
          ))}
        </span>
      </button>
    </div>
  )
}

export function MonthView({ anchor, selectMode, selected, onDayClick }: ViewProps) {
  const byDate = useSlotsByDate()
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const gridStart = startOfWeek(first)
  const gridEnd = addDays(startOfWeek(last), 6)
  const days = dateRange(gridStart, gridEnd)
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
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
            {w.map((d) => (
              <DayCell key={d} date={d} inMonth={d >= first && d <= last} slots={byDate.get(d) ?? []} selectMode={selectMode} selected={selected.has(d)} onDayClick={onDayClick} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WeekView({ anchor, selectMode, selected, onDayClick }: ViewProps) {
  const byDate = useSlotsByDate()
  const days = dateRange(startOfWeek(anchor), addDays(startOfWeek(anchor), 6))
  return (
    <div role="grid" aria-label="週表示の出題計画" className="overflow-x-auto rounded-lg border">
      <div className="grid min-w-[42rem] grid-cols-7 gap-px bg-border">
        {days.map((d) => (
          <div key={d} className="flex flex-col bg-card">
            <div className={cn("border-b bg-muted/60 py-1.5 text-center text-xs", d === DEMO_TODAY ? "font-semibold text-primary" : "text-muted-foreground")}>
              {formatDate(d, { weekday: true })}
            </div>
            <DayCell date={d} inMonth slots={byDate.get(d) ?? []} selectMode={selectMode} selected={selected.has(d)} onDayClick={onDayClick} tall />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListView({ anchor, onDayClick }: ViewProps) {
  const { data } = useQuiz()
  const categoryName = useCategoryName()
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const slots = data.slots
    .filter((s) => CAL_PLATFORMS.includes(s.platform) && s.date >= first && s.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform))

  if (!slots.length) return <EmptyState title="この月の出題枠はありません" description="週間テンプレートを適用するか、日付を選択して出題枠を追加してください" />

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[48rem] text-sm">
        <caption className="sr-only">出題計画の一覧</caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {["日付", "媒体", "カテゴリ", "難易度", "時事性", "時刻", "問題", "状態"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {slots.map((s) => {
            const q = data.questions.find((x) => x.id === s.questionId)
            return (
              <tr key={s.id} className={cn("cursor-pointer hover:bg-accent", s.date === DEMO_TODAY && "bg-primary/5")} onClick={() => onDayClick(s.date)}>
                <td className="whitespace-nowrap px-3 py-2">
                  <button type="button" className="hover:underline" onClick={() => onDayClick(s.date)}>
                    {formatDate(s.date, { weekday: true })}
                  </button>
                </td>
                <td className="px-3 py-2"><PlatformBadge platform={s.platform} /></td>
                <td className="px-3 py-2">{categoryName(s.categoryId)}</td>
                <td className="px-3 py-2">{DIFFICULTY_LABEL[s.difficulty]}</td>
                <td className="px-3 py-2">{TIMELINESS_LABEL[s.timeliness]}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{s.time}</td>
                <td className="max-w-64 truncate px-3 py-2" title={q?.text}>
                  {q ? <><span className="mr-1.5 font-mono text-xs text-muted-foreground">{q.id}</span>{q.text}</> : <span className="text-muted-foreground">未割当</span>}
                </td>
                <td className="px-3 py-2"><StatusBadge {...PLAN_STATUS[s.status]} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
