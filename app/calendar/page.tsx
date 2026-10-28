"use client"

import { useState } from "react"
import { CalendarCog, ChevronLeft, ChevronRight, ListChecks, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeader } from "@/components/shared/page-header"
import { useQuiz } from "@/lib/store/quiz-store"
import { addDays, addMonths, DEMO_TODAY, formatDate, startOfWeek } from "@/lib/format"
import { ListView, MonthView, WeekView } from "@/components/calendar/calendar-views"
import { DaySheet } from "@/components/calendar/day-sheet"
import { LiveCalendar } from "@/components/calendar/live-calendar"
import { BulkSetDialog, TemplateDialog } from "@/components/calendar/plan-dialogs"

type View = "month" | "week" | "list"

export default function CalendarPage() {
  const { state, can } = useQuiz()
  const [view, setView] = useState<View>("month")
  const [anchor, setAnchor] = useState(DEMO_TODAY)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)

  const step = (dir: 1 | -1) => setAnchor((a) => (view === "week" ? addDays(a, 7 * dir) : addMonths(a, dir)))
  const title =
    view === "week" ? `${formatDate(startOfWeek(anchor))}〜${formatDate(addDays(startOfWeek(anchor), 6))}` : `${anchor.slice(0, 4)}年${Number(anchor.slice(5, 7))}月`

  const onDayClick = (date: string) => {
    if (!selectMode) return setOpenDate(date)
    if (date <= DEMO_TODAY) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const ViewComp = view === "month" ? MonthView : view === "week" ? WeekView : ListView
  const live = state.settings.dataMode === "live"

  return (
    <>
      <PageHeader
        title="出題計画"
        description={live ? "出題日が入った問題と投稿の記録を日付ごとに表示します。空いている日には予備問題を割り当てられます" : "日付ごとの出題条件を管理します。枠をドラッグすると別の日へ移動できます"}
        actions={
          live ? undefined : <>
            <Button variant="outline" onClick={() => setTplOpen(true)}>
              <CalendarCog className="size-4" aria-hidden />
              週間テンプレート
            </Button>
            {can("plan") && view !== "list" && (
              <Button variant={selectMode ? "secondary" : "outline"} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
                <ListChecks className="size-4" aria-hidden />
                {selectMode ? "選択を終了" : "複数日を選択"}
              </Button>
            )}
          </>
        }
      />

      {live ? (
        <LiveCalendar />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="前へ" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" size="icon" aria-label="次へ" onClick={() => step(1)}>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAnchor(DEMO_TODAY)}>
                今日
              </Button>
            </div>
            <h2 className="text-lg font-semibold tabular-nums" aria-live="polite">
              {title}
            </h2>
            <ToggleGroup
              className="ml-auto"
              variant="outline"
              size="sm"
              value={[view]}
              onValueChange={(v) => v[0] && setView(v[0] as View)}
              aria-label="表示切替"
            >
              <ToggleGroupItem value="month">月</ToggleGroupItem>
              <ToggleGroupItem value="week">週</ToggleGroupItem>
              <ToggleGroupItem value="list">一覧</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {selectMode && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm">
              <span>
                <span className="font-mono font-semibold tabular-nums">{selected.size}</span>日を選択中（翌日以降のみ選択できます）
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={!selected.size}>
                  <X className="size-3.5" aria-hidden />
                  クリア
                </Button>
                <Button size="sm" disabled={!selected.size} onClick={() => setBulkOpen(true)}>
                  一括設定
                </Button>
              </div>
            </div>
          )}

          <ViewComp anchor={anchor} selectMode={selectMode} selected={selected} onDayClick={onDayClick} />

          <DaySheet date={openDate} onOpenChange={(o) => !o && setOpenDate(null)} />
          <BulkSetDialog key={bulkOpen ? "open" : "closed"} open={bulkOpen} onOpenChange={setBulkOpen} dates={[...selected]} onApplied={exitSelect} />
          <TemplateDialog open={tplOpen} onOpenChange={setTplOpen} anchor={anchor} />
        </>
      )}
    </>
  )
}
