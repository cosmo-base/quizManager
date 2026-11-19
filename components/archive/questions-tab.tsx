"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type { ArchiveFieldId, ArchiveQuestionStatus, ArchiveQuestionSummary, ArchiveSaveNoticeInput } from "@/lib/services/gas-contract"
import { ARCHIVE_DIFFICULTY_LABEL, ARCHIVE_FIELD_LABEL, ARCHIVE_FIELDS, ARCHIVE_STATUS_LABEL, errorMessage, formatAccuracy } from "@/lib/archive"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SimpleSelect } from "@/components/shared/simple-select"
import { EmptyState } from "@/components/shared/states"
import { ArchiveQuestionEditor } from "./question-editor"

const PAGE_SIZE = 50

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
  const [query, setQuery] = useState("")
  const [field, setField] = useState<ArchiveFieldId | "all">("all")
  const [status, setStatus] = useState<ArchiveQuestionStatus | "all">("all")
  const [reportedOnly, setReportedOnly] = useState(false)
  const [page, setPage] = useState(0)

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list ?? []).filter((x) => {
      if (field !== "all" && x.fieldId !== field) return false
      if (status !== "all" && x.status !== status) return false
      if (reportedOnly && x.openReports === 0) return false
      if (!q) return true
      return x.id.toLowerCase().includes(q) || x.text.toLowerCase().includes(q) || x.choices.some((c) => c.text.toLowerCase().includes(q))
    })
  }, [list, query, field, status, reportedOnly])
  useEffect(() => setPage(0), [query, field, status, reportedOnly])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:flex-wrap md:items-center">
        <div className="relative min-w-0 flex-1 md:min-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="問題ID・問題文・選択肢で探す" aria-label="問題を探す" className="pl-8" />
        </div>
        <SimpleSelect
          aria-label="分野"
          className="md:w-40"
          value={field}
          onChange={setField}
          options={[{ value: "all", label: "すべての分野" }, ...ARCHIVE_FIELDS.map((f) => ({ value: f, label: ARCHIVE_FIELD_LABEL[f] }))]}
        />
        <SimpleSelect
          aria-label="公開状態"
          className="md:w-32"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "すべて" },
            { value: "published", label: "公開" },
            { value: "stopped", label: "停止" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={reportedOnly} onCheckedChange={(c) => setReportedOnly(Boolean(c))} />
          未対応の誤り報告あり
        </label>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          読み込み直す
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {list === null ? (
        !error && <p className="text-sm text-muted-foreground">読み込んでいます…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="条件に合う問題はありません" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} 問（全 {list.length} 問）
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">問題ID</TableHead>
                  <TableHead className="w-28">出題日</TableHead>
                  <TableHead className="w-28">分野</TableHead>
                  <TableHead>問題文</TableHead>
                  <TableHead className="w-24">正答率</TableHead>
                  <TableHead className="w-20">状態</TableHead>
                  <TableHead className="w-20">報告</TableHead>
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
                      <span className="block text-xs">{ARCHIVE_DIFFICULTY_LABEL[x.difficulty]}</span>
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
