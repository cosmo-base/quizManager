"use client"

import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { SampleTag } from "@/components/shared/states"
import { DIFFICULTY_LABEL, FACTCHECK_STATUS, QUESTION_STATUS } from "@/lib/constants"
import { formatCount, formatDate, formatPercent } from "@/lib/format"
import type { Question, SystemSettings } from "@/lib/types"
import { cn } from "@/lib/utils"
import { responseStats, reusableDate, type SortKey } from "./library-utils"
import { questionHref } from "@/lib/routes"

export const COLUMNS = [
  { key: "id", label: "問題ID", sort: "id" },
  { key: "text", label: "問題文" },
  { key: "platform", label: "媒体" },
  { key: "category", label: "分類" },
  { key: "difficulty", label: "難易度" },
  { key: "answer", label: "正解" },
  { key: "date", label: "出題日", sort: "date" },
  { key: "status", label: "問題状態" },
  { key: "responses", label: "回答数", sort: "responses" },
  { key: "rate", label: "正答率", sort: "rate" },
  { key: "factCheck", label: "検証状態" },
  { key: "reuse", label: "再出題可能日" },
] as const satisfies readonly { key: string; label: string; sort?: SortKey }[]

export type ColumnKey = (typeof COLUMNS)[number]["key"]

interface ViewProps {
  questions: Question[]
  categoryName: (id: string) => string
  rules: SystemSettings["rules"]
  today: string
}

function ReuseCell({ q, rules, today }: { q: Question; rules: SystemSettings["rules"]; today: string }) {
  const from = reusableDate(q, rules)
  if (!from) return <span className="text-muted-foreground">—</span>
  return <span className={cn("font-mono text-xs tabular-nums", from <= today ? "text-success" : "text-muted-foreground")}>{from}</span>
}

export function LibraryTable({
  questions,
  categoryName,
  rules,
  today,
  visible,
  sortKey,
  sortDir,
  onSort,
}: ViewProps & {
  visible: Set<ColumnKey>
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const cols = COLUMNS.filter((c) => visible.has(c.key))

  const cell = (q: Question, key: ColumnKey) => {
    const s = responseStats(q)
    switch (key) {
      case "id":
        return (
          <Link href={questionHref(q.id)} className="font-mono text-xs text-primary underline-offset-4 hover:underline">
            {q.id}
          </Link>
        )
      case "text":
        return (
          <Link href={questionHref(q.id)} className="flex max-w-md items-center gap-2 hover:underline">
            <span className="truncate">{q.text}</span>
            {q.isSample && <SampleTag />}
          </Link>
        )
      case "platform":
        return <PlatformMark platform={q.platform} />
      case "category":
        return categoryName(q.categoryId)
      case "difficulty":
        return DIFFICULTY_LABEL[q.difficulty]
      case "answer":
        return <span className="font-mono font-semibold">{q.answer}</span>
      case "date":
        return <span className="tabular-nums">{q.plannedDate ? formatDate(q.plannedDate) : "—"}</span>
      case "status":
        return <StatusBadge {...QUESTION_STATUS[q.status]} />
      case "responses":
        return <span className="tabular-nums">{formatCount(s.responses)}</span>
      case "rate":
        return <span className="tabular-nums">{formatPercent(s.correct, s.responses)}</span>
      case "factCheck":
        return <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
      case "reuse":
        return <ReuseCell q={q} rules={rules} today={today} />
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => {
              const sortable = "sort" in c
              const active = sortable && sortKey === c.sort
              const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <TableHead
                  key={c.key}
                  aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn((c.key === "responses" || c.key === "rate") && "text-right")}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.sort)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.label}
                      <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
                    </button>
                  ) : (
                    c.label
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.id}>
              {cols.map((c) => (
                <TableCell key={c.key} className={cn((c.key === "responses" || c.key === "rate") && "text-right")}>
                  {cell(q, c.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function LibraryCards({ questions, categoryName, rules, today }: ViewProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {questions.map((q) => {
        const s = responseStats(q)
        return (
          <li key={q.id}>
            <Link href={questionHref(q.id)} className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <PlatformMark platform={q.platform} />
                    <span className="font-mono text-xs text-muted-foreground">{q.id}</span>
                    {q.isSample && <SampleTag />}
                    <StatusBadge {...QUESTION_STATUS[q.status]} className="ml-auto" />
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-pretty">{q.text}</p>
                  <ol className="flex flex-col gap-1 text-xs">
                    {q.choices.map((c) => (
                      <li
                        key={c.label}
                        className={cn("flex gap-2 rounded px-2 py-1", c.label === q.answer ? "bg-success/10 text-success" : "text-muted-foreground")}
                      >
                        <span className="font-mono font-semibold">{c.label}</span>
                        <span className="truncate">{c.text}</span>
                      </li>
                    ))}
                  </ol>
                  <dl className="mt-auto grid grid-cols-4 gap-2 border-t pt-3 text-xs">
                    <Stat label="分類" value={categoryName(q.categoryId)} />
                    <Stat label="出題日" value={q.plannedDate ? formatDate(q.plannedDate) : "—"} />
                    <Stat label="回答数" value={formatCount(s.responses)} />
                    <Stat label="正答率" value={formatPercent(s.correct, s.responses)} />
                  </dl>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
                    <span className="flex items-center gap-1">
                      再出題 <ReuseCell q={q} rules={rules} today={today} />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  )
}
