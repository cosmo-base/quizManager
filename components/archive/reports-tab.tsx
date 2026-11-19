"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type { ArchiveReport, ArchiveReportStatus } from "@/lib/services/gas-contract"
import { ARCHIVE_REPORT_REASON_LABEL, ARCHIVE_REPORT_STATUS_LABEL, errorMessage, formatJst } from "@/lib/archive"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimpleSelect } from "@/components/shared/simple-select"
import { EmptyState } from "@/components/shared/states"

const STATUS_OPTIONS = (Object.keys(ARCHIVE_REPORT_STATUS_LABEL) as ArchiveReportStatus[]).map((s) => ({ value: s, label: ARCHIVE_REPORT_STATUS_LABEL[s] }))

/** 参加者からの誤り報告。報告した人は出さない（Archive の GAS が返さない） */
export function ArchiveReportsTab({ canEdit, onOpenQuestion }: { canEdit: boolean; onOpenQuestion: (id: string) => void }) {
  const { state } = useQuiz()
  const backend = getBackend(state.settings.dataMode)
  const [reports, setReports] = useState<ArchiveReport[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<ArchiveReportStatus | "all">("received")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    backend
      .archiveListReports()
      .then((r) => setReports(r.reports))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [backend])
  useEffect(() => load(), [load])

  const shown = useMemo(() => (reports ?? []).filter((r) => filter === "all" || r.status === filter), [reports, filter])
  const openCount = (reports ?? []).filter((r) => r.status === "received").length

  const update = (r: ArchiveReport, status: ArchiveReportStatus) => {
    if (status === r.status) return
    setBusyId(r.reportId)
    backend
      .archiveUpdateReport(r.reportId, status)
      .then(() => {
        setReports((prev) => (prev ? prev.map((x) => (x.reportId === r.reportId ? { ...x, status } : x)) : prev))
        toast.success(`「${ARCHIVE_REPORT_STATUS_LABEL[status]}」にしました`)
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusyId(null))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <SimpleSelect aria-label="状態で絞り込む" className="w-40" value={filter} onChange={setFilter} options={[{ value: "all", label: "すべて" }, ...STATUS_OPTIONS]} />
        <span className="text-sm text-muted-foreground">未対応 {openCount} 件</span>
        <Button variant="outline" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          読み込み直す
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {reports === null ? (
        !error && <p className="text-sm text-muted-foreground">読み込んでいます…</p>
      ) : shown.length === 0 ? (
        <EmptyState title={filter === "received" ? "未対応の報告はありません" : "報告はありません"} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <li key={r.reportId} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button type="button" className="font-mono text-primary underline-offset-4 hover:underline" onClick={() => onOpenQuestion(r.questionId)}>
                  {r.questionId}
                </button>
                <Badge variant="outline">{ARCHIVE_REPORT_REASON_LABEL[r.reason] ?? r.reason}</Badge>
                <span className="text-xs text-muted-foreground">{formatJst(r.createdAt)}</span>
                {r.versionId && <span className="text-xs text-muted-foreground">（{r.versionId}）</span>}
                <div className="ml-auto w-36">
                  {canEdit ? (
                    <SimpleSelect aria-label="報告の状態" size="sm" disabled={busyId === r.reportId} value={r.status} onChange={(s) => update(r, s)} options={STATUS_OPTIONS} />
                  ) : (
                    <Badge variant={r.status === "received" ? "destructive" : "secondary"}>{ARCHIVE_REPORT_STATUS_LABEL[r.status]}</Badge>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.detail || <span className="text-muted-foreground">（内容なし）</span>}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
