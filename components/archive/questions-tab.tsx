"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, RefreshCw, Search, X } from "lucide-react"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type { ArchiveDifficulty, ArchiveQuestionSummary, ArchiveSaveNoticeInput } from "@/lib/services/gas-contract"
import { ARCHIVE_DIFFICULTY_LABEL, ARCHIVE_FIELD_LABEL, ARCHIVE_FIELDS, ARCHIVE_STATUS_LABEL, errorMessage, formatAccuracy } from "@/lib/archive"
import {
  advancedCount,
  ARCHIVE_ISSUE_LABEL,
  ARCHIVE_PLATFORM_LABEL,
  ARCHIVE_PLATFORMS,
  ARCHIVE_SORT_LABEL,
  columnDirection,
  DEFAULT_ARCHIVE_FILTER,
  nextColumnSort,
  filterArchiveQuestions,
  isDefaultFilter,
  type ArchiveFilter,
  type ArchiveIssue,
  type ArchiveSort,
  type ArchiveSortColumn,
} from "@/lib/archive-filter"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SimpleSelect } from "@/components/shared/simple-select"
import { EmptyState } from "@/components/shared/states"
import { ArchiveQuestionEditor } from "./question-editor"

const PAGE_SIZES = [
  { value: "50", label: "50件ずつ" },
  { value: "100", label: "100件ずつ" },
  { value: "all", label: "全部" },
] as const
const DIFFICULTIES: ArchiveDifficulty[] = ["beginner", "intermediate", "advanced", "expert", "unknown"]

/** いくつでも選べる絞り込み（押すと入る・もう一度押すと外れる） */
function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                "h-7 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 押すと並び替える列の見出し。今並べている列には向きの矢印と aria-sort を付ける */
function SortHead({ column, sort, onSort, className, children }: { column: ArchiveSortColumn; sort: ArchiveSort; onSort: (s: ArchiveSort) => void; className?: string; children: React.ReactNode }) {
  const dir = columnDirection(sort, column)
  const Icon = dir === "ascending" ? ArrowUp : dir === "descending" ? ArrowDown : ArrowUpDown
  return (
    <TableHead className={className} aria-sort={dir ?? "none"}>
      <button
        type="button"
        onClick={() => onSort(nextColumnSort(sort, column))}
        className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50", dir && "text-foreground")}
      >
        {children}
        <Icon className={cn("size-3.5", dir ? "text-primary" : "text-muted-foreground/60")} aria-hidden />
      </button>
    </TableHead>
  )
}

export function ArchiveQuestionsTab({
  canEdit,
  openId,
  onOpen,
  onDraftNotice,
}: {
  canEdit: boolean
  openId: string | null
  onOpen: (id: string | null) => void
  onDraftNotice: (draft: ArchiveSaveNoticeInput) => void
}) {
  const { state } = useQuiz()
  const backend = getBackend(state.settings.dataMode)
  const [list, setList] = useState<ArchiveQuestionSummary[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<ArchiveFilter>(DEFAULT_ARCHIVE_FILTER)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]["value"]>("50")
  const [page, setPage] = useState(0)
  const set = <K extends keyof ArchiveFilter>(k: K, v: ArchiveFilter[K]) => setFilter((f) => ({ ...f, [k]: v }))

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    backend
      .archiveListQuestions()
      .then((r) => setList(r.questions))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [backend])
  useEffect(() => load(), [load])

  const filtered = useMemo(() => filterArchiveQuestions(list ?? [], filter), [list, filter])
  useEffect(() => setPage(0), [filter, pageSize])
  const size = pageSize === "all" ? Math.max(filtered.length, 1) : Number(pageSize)
  const pageCount = Math.max(1, Math.ceil(filtered.length / size))
  const shown = filtered.slice(page * size, (page + 1) * size)
  const advanced = advancedCount(filter)
  const accuracyRange = filter.accuracyMin !== "" || filter.accuracyMax !== ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="relative min-w-0 flex-1 md:min-w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={filter.query} onChange={(e) => set("query", e.target.value)} placeholder="問題ID・問題文・選択肢で探す" aria-label="問題を探す" className="pl-8" />
          </div>
          <SimpleSelect<ArchiveSort>
            aria-label="並び替え"
            className="md:w-56"
            value={filter.sort}
            onChange={(v) => set("sort", v)}
            options={(Object.keys(ARCHIVE_SORT_LABEL) as ArchiveSort[]).map((k) => ({ value: k, label: ARCHIVE_SORT_LABEL[k] }))}
          />
          <SimpleSelect
            aria-label="公開状態"
            className="md:w-32"
            value={filter.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "all", label: "公開・停止" },
              { value: "published", label: "公開だけ" },
              { value: "stopped", label: "停止だけ" },
            ]}
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
            読み込み直す
          </Button>
        </div>

        <Chips label="分野" options={ARCHIVE_FIELDS.map((f) => ({ value: f, label: ARCHIVE_FIELD_LABEL[f] }))} value={filter.fields} onChange={(v) => set("fields", v)} />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-expanded={advancedOpen} aria-controls="arc-advanced" onClick={() => setAdvancedOpen((o) => !o)}>
            <ChevronDown data-icon="inline-start" className={cn("transition-transform", advancedOpen && "rotate-180")} />
            詳しい条件{advanced > 0 && `（${advanced}）`}
          </Button>
          {!isDefaultFilter(filter) && (
            <Button variant="ghost" size="sm" onClick={() => setFilter(DEFAULT_ARCHIVE_FILTER)}>
              <X data-icon="inline-start" />
              条件をすべて外す
            </Button>
          )}
        </div>

        {advancedOpen && (
          <div id="arc-advanced" className="grid grid-cols-1 gap-4 border-t border-border pt-4 lg:grid-cols-2">
            <Chips label="難易度" options={DIFFICULTIES.map((d) => ({ value: d, label: ARCHIVE_DIFFICULTY_LABEL[d] }))} value={filter.difficulties} onChange={(v) => set("difficulties", v)} />
            <Chips label="出題した媒体（どれかに出したもの）" options={ARCHIVE_PLATFORMS.map((p) => ({ value: p, label: ARCHIVE_PLATFORM_LABEL[p] }))} value={filter.platforms} onChange={(v) => set("platforms", v)} />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">出題日の期間</span>
              <div className="flex items-center gap-2">
                <Input type="date" aria-label="出題日（いつから）" value={filter.postedFrom} onChange={(e) => set("postedFrom", e.target.value)} />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input type="date" aria-label="出題日（いつまで）" value={filter.postedTo} onChange={(e) => set("postedTo", e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">正答率の範囲（%）</span>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="number" min={0} max={100} inputMode="numeric" aria-label="正答率（下限 %）" placeholder="0" className="w-20" value={filter.accuracyMin} onChange={(e) => set("accuracyMin", e.target.value)} />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input type="number" min={0} max={100} inputMode="numeric" aria-label="正答率（上限 %）" placeholder="100" className="w-20" value={filter.accuracyMax} onChange={(e) => set("accuracyMax", e.target.value)} />
                <label className={cn("flex items-center gap-2 text-sm", !accuracyRange && "text-muted-foreground")}>
                  <Checkbox disabled={!accuracyRange} checked={filter.includeUnrated} onCheckedChange={(c) => set("includeUnrated", Boolean(c))} />
                  未集計も含める
                </label>
              </div>
            </div>

            <Chips<ArchiveIssue>
              label="要確認の問題（どれかに当てはまるもの）"
              options={(Object.keys(ARCHIVE_ISSUE_LABEL) as ArchiveIssue[]).map((k) => ({ value: k, label: ARCHIVE_ISSUE_LABEL[k] }))}
              value={filter.issues}
              onChange={(v) => set("issues", v)}
            />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">そのほか</span>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={filter.reportedOnly} onCheckedChange={(c) => set("reportedOnly", Boolean(c))} />
                未対応の誤り報告がある
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={filter.revisedOnly} onCheckedChange={(c) => set("revisedOnly", Boolean(c))} />
                修正したことがある（版が2つ以上）
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox checked={filter.fixedOnly} onCheckedChange={(c) => set("fixedOnly", Boolean(c))} />
                難易度を手で固定している
              </Label>
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {list === null ? (
        !error && <p className="text-sm text-muted-foreground">読み込んでいます…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="条件に合う問題はありません" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} 問（全 {list.length} 問）
            </p>
            <SimpleSelect aria-label="1ページに出す数" size="sm" className="w-32" value={pageSize} onChange={setPageSize} options={[...PAGE_SIZES]} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead column="id" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-24">問題ID</SortHead>
                  <SortHead column="posted" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-28">出題日</SortHead>
                  <SortHead column="field" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-28">分野</SortHead>
                  <TableHead>問題文</TableHead>
                  <SortHead column="accuracy" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-24">正答率</SortHead>
                  <SortHead column="status" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-20">状態</SortHead>
                  <SortHead column="reports" sort={filter.sort} onSort={(s) => set("sort", s)} className="w-20">報告</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((x) => (
                  <TableRow key={x.id} className="cursor-pointer" onClick={() => onOpen(x.id)}>
                    <TableCell>
                      <button type="button" className="font-mono text-primary underline-offset-4 hover:underline" onClick={() => onOpen(x.id)}>
                        {x.id}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{x.postedOn}</TableCell>
                    <TableCell>{ARCHIVE_FIELD_LABEL[x.fieldId] ?? x.fieldId}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="line-clamp-2 whitespace-normal">{x.text || <span className="text-muted-foreground">（問題文がありません）</span>}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatAccuracy(x.displayAccuracy)}
                      <span className="block text-xs">
                        {ARCHIVE_DIFFICULTY_LABEL[x.difficulty]}
                        {x.difficultyOverride && <span className="ml-1 rounded border border-border px-1 text-[10px]">固定</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={x.status === "published" ? "secondary" : "destructive"}>{ARCHIVE_STATUS_LABEL[x.status] ?? x.status}</Badge>
                    </TableCell>
                    <TableCell>{x.openReports > 0 ? <Badge variant="destructive">{x.openReports} 件</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                前へ
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {pageCount}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                次へ
              </Button>
            </div>
          )}
        </>
      )}

      <ArchiveQuestionEditor
        questionId={openId}
        canEdit={canEdit}
        onClose={() => onOpen(null)}
        onSaved={(summary) => setList((prev) => (prev ? prev.map((x) => (x.id === summary.id ? { ...x, ...summary } : x)) : prev))}
        onDraftNotice={onDraftNotice}
      />
    </div>
  )
}
