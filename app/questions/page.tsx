"use client"

import { useMemo, useState } from "react"
import { Columns3, Download, LayoutGrid, Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState, LiveEmptyState } from "@/components/shared/states"
import { LibraryFilterBar } from "@/components/questions/library-filters"
import { COLUMNS, LibraryCards, LibraryTable, type ColumnKey } from "@/components/questions/library-views"
import {
  downloadCsv,
  EMPTY_FILTERS,
  filterQuestions,
  questionsToCsv,
  sortQuestions,
  type LibraryFilters,
  type SortKey,
} from "@/components/questions/library-utils"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import { DEMO_TODAY } from "@/lib/format"

const PAGE_SIZE = 20
const DEFAULT_HIDDEN: ColumnKey[] = ["answer", "reuse"]

export default function QuestionsPage() {
  const { state, data } = useQuiz()
  const categoryName = useCategoryName()
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS)
  const [view, setView] = useState<"table" | "cards">("table")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [visible, setVisible] = useState<Set<ColumnKey>>(
    () => new Set(COLUMNS.map((c) => c.key).filter((k) => !DEFAULT_HIDDEN.includes(k))),
  )

  const rules = state.settings.rules
  const results = useMemo(
    () => sortQuestions(filterQuestions(data.questions, filters, { postJobs: data.postJobs, rules, today: DEMO_TODAY }), sortKey, sortDir),
    [data.questions, data.postJobs, filters, rules, sortKey, sortDir],
  )
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageItems = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const updateFilters = (f: LibraryFilters) => {
    setFilters(f)
    setPage(1)
  }
  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(k)
      setSortDir("desc")
    }
  }
  const toggleColumn = (k: ColumnKey) =>
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const exportCsv = () => downloadCsv(`questions-${DEMO_TODAY}.csv`, questionsToCsv(results, categoryName))

  const isLiveEmpty = state.settings.dataMode === "live" && data.questions.length === 0

  return (
    <>
      <PageHeader
        title="問題ライブラリ"
        description="新規生成・予約・出題済みの問題を横断して検索・管理します"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={results.length === 0}>
            <Download />
            CSV出力（{results.length}件）
          </Button>
        }
      />
      {isLiveEmpty ? (
        <LiveEmptyState what="問題" />
      ) : (
        <div className="flex flex-col gap-4">
          <LibraryFilterBar filters={filters} onChange={updateFilters} categories={data.categories} />

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-medium text-foreground tabular-nums">{results.length}</span> 件
              {results.length > 0 && (
                <span className="tabular-nums">
                  {" "}
                  （{(current - 1) * PAGE_SIZE + 1}〜{Math.min(current * PAGE_SIZE, results.length)}件目）
                </span>
              )}
            </p>
            <div className="ml-auto flex items-center gap-2">
              {view === "table" && (
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                    <Columns3 />
                    表示列
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52">
                    <fieldset className="flex flex-col gap-2">
                      <legend className="mb-1 text-xs font-medium text-muted-foreground">表示する列</legend>
                      {COLUMNS.map((c) => (
                        <div key={c.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`col-${c.key}`}
                            checked={visible.has(c.key)}
                            onCheckedChange={() => toggleColumn(c.key)}
                            disabled={c.key === "id"}
                          />
                          <Label htmlFor={`col-${c.key}`} className="font-normal">
                            {c.label}
                          </Label>
                        </div>
                      ))}
                    </fieldset>
                  </PopoverContent>
                </Popover>
              )}
              <ToggleGroup
                value={[view]}
                onValueChange={(v: string[]) => v[0] && setView(v[0] as "table" | "cards")}
                variant="outline"
                size="sm"
                aria-label="表示形式"
              >
                <ToggleGroupItem value="table" aria-label="テーブル表示">
                  <Rows3 />
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" aria-label="カード表示">
                  <LayoutGrid />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="条件に一致する問題がありません"
              description="検索条件を減らすか、クリアしてください"
              action={
                <Button variant="outline" onClick={() => updateFilters(EMPTY_FILTERS)}>
                  条件をクリア
                </Button>
              }
            />
          ) : view === "table" ? (
            <LibraryTable
              questions={pageItems}
              categoryName={categoryName}
              rules={rules}
              today={DEMO_TODAY}
              visible={visible}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
          ) : (
            <LibraryCards questions={pageItems} categoryName={categoryName} rules={rules} today={DEMO_TODAY} />
          )}

          {pageCount > 1 && (
            <nav aria-label="ページ送り" className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                前へ
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {current} / {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                次へ
              </Button>
            </nav>
          )}
        </div>
      )}
    </>
  )
}
