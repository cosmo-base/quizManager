"use client"

import Link from "next/link"
import { Circle, CircleAlert, CircleCheck, CircleDashed, CircleX, Loader2, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState, SampleTag } from "@/components/shared/states"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { useQuiz } from "@/lib/store/quiz-store"
import { AI_MODELS } from "@/lib/constants"
import { formatDate, formatDateTime, formatYen } from "@/lib/format"
import type { GenerationJob, PipelineStepStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEP_ICON: Record<PipelineStepStatus, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  pending: { icon: Circle, cls: "text-muted-foreground/50", label: "待機" },
  running: { icon: Loader2, cls: "animate-spin text-primary", label: "実行中" },
  done: { icon: CircleCheck, cls: "text-success", label: "完了" },
  warn: { icon: CircleAlert, cls: "text-warning", label: "警告" },
  error: { icon: CircleX, cls: "text-destructive", label: "エラー" },
  skipped: { icon: CircleDashed, cls: "text-muted-foreground", label: "スキップ" },
}

export const JOB_STATUS: Record<GenerationJob["status"], { label: string; tone: "info" | "success" | "danger" | "muted" | "neutral" }> = {
  queued: { label: "待機中", tone: "neutral" },
  running: { label: "実行中", tone: "info" },
  completed: { label: "完了", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  cancelled: { label: "中止", tone: "muted" },
}

const MODE_LABEL: Record<GenerationJob["mode"], string> = { daily: "日次生成", bulk: "期間一括", single: "単発生成" }

export function JobProgress({ job }: { job: GenerationJob | undefined }) {
  const { actions, data } = useQuiz()
  if (!job) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="生成ジョブはまだありません" description="左のフォームから条件を指定して生成を開始してください" />
        </CardContent>
      </Card>
    )
  }
  const pct = job.total ? Math.round((job.completed / job.total) * 100) : 0
  const results = data.questions.filter((q) => job.resultIds.includes(q.id))

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="font-mono">{job.id}</CardTitle>
          <StatusBadge {...JOB_STATUS[job.status]} />
          {job.isDemo && <SampleTag />}
          {job.status === "running" && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" className="ml-auto">
                  <Square className="size-3.5" aria-hidden />
                  中止
                </Button>
              }
              title="生成ジョブを中止しますか？"
              description="生成済みの候補は残り、未処理の出題枠は「生成待ち」に戻ります。"
              target={job.id}
              confirmLabel="中止する"
              destructive
              onConfirm={() => actions.cancelJob(job.id)}
            />
          )}
        </div>
        <CardDescription>
          {MODE_LABEL[job.mode]}・{AI_MODELS.find((m) => m.id === job.model)?.label ?? job.model}・開始 {formatDateTime(job.startedAt)}
          {job.range && `・${formatDate(job.range.from)}〜${formatDate(job.range.to)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="font-mono text-xl font-semibold tabular-nums">{job.completed}</span>
              <span className="text-muted-foreground"> / {job.total}件</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <Progress value={pct} aria-label="生成の進捗" />
          <dl className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
            {[
              ["確定", job.success, "text-success"],
              ["要確認", job.needsReview, "text-warning"],
              ["却下", job.rejected, "text-muted-foreground"],
              ["エラー", job.errors, "text-destructive"],
            ].map(([k, v, c]) => (
              <div key={k as string} className="rounded-md border py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className={cn("font-mono text-base font-semibold tabular-nums", c as string)}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ol aria-label="処理ステップ" className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {job.steps.map((s) => {
            const meta = STEP_ICON[s.status]
            const Icon = meta.icon
            return (
              <li key={s.key} className={cn("flex items-start gap-2 text-sm", s.status === "pending" && "text-muted-foreground")}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", meta.cls)} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span>
                    {s.label}
                    <span className="sr-only">：{meta.label}</span>
                  </span>
                  {s.result && <span className="truncate text-xs text-muted-foreground">{s.result}</span>}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">費用</span>
          <span className="font-mono tabular-nums">
            {job.actualCostJpy !== null ? formatYen(job.actualCostJpy) : `推定 ${formatYen(job.estimatedCostJpy)}`}
          </span>
        </div>

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">生成結果</h3>
              {job.needsReview > 0 && (
                <Button size="sm" variant="link" render={<Link href="/review" />}>
                  確認待ちを開く
                </Button>
              )}
            </div>
            <ul className="flex flex-col divide-y rounded-lg border">
              {results.map((q) => (
                <li key={q.id}>
                  <Link href={`/questions/${q.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                    <PlatformMark platform={q.platform} />
                    <span className="font-mono text-xs text-muted-foreground">{q.id}</span>
                    <span className="min-w-0 flex-1 truncate">{q.text}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{Object.values(q.quality).reduce((sum, v) => sum + v, 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function JobHistory({ jobs, selectedId, onSelect }: { jobs: GenerationJob[]; selectedId: string | undefined; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>生成履歴</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">履歴はありません</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {jobs.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  aria-current={j.id === selectedId ? "true" : undefined}
                  onClick={() => onSelect(j.id)}
                  className={cn("flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm hover:bg-accent", j.id === selectedId && "bg-accent")}
                >
                  <span className="font-mono text-xs">{j.id}</span>
                  <span className="text-muted-foreground">{MODE_LABEL[j.mode]}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{formatDateTime(j.startedAt)}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    {j.completed}/{j.total}
                  </span>
                  <StatusBadge {...JOB_STATUS[j.status]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
