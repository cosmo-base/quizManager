"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Info, OctagonAlert } from "lucide-react"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/states"
import type { Integration } from "@/lib/types"

const MODE_LABEL = { daily: "毎日自動", bulk: "期間一括", single: "個別" } as const
const JOB_STATUS = {
  queued: { label: "待機中", tone: "neutral" },
  running: { label: "実行中", tone: "info" },
  completed: { label: "完了", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  cancelled: { label: "中止", tone: "muted" },
} as const

export function JobsPanel() {
  const { data } = useQuiz()
  const jobs = data.jobs.slice(0, 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI生成ジョブ</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/generate" />}>
            すべて表示
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <EmptyState title="生成ジョブはまだありません" />
        ) : (
          <ul className="flex flex-col divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{j.id}</span>
                  <span className="text-muted-foreground">{MODE_LABEL[j.mode]}</span>
                  <span className="ml-auto">
                    <StatusBadge {...JOB_STATUS[j.status]} />
                  </span>
                </div>
                <Progress value={(j.completed / Math.max(1, j.total)) * 100} aria-label={`${j.id}の進捗`} />
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {j.completed}/{j.total}件・成功{j.success}・要確認{j.needsReview}・不採用{j.rejected}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

const LEVEL_ICON = { error: OctagonAlert, warning: AlertTriangle, info: Info, success: CheckCircle2 }
const LEVEL_CLASS = { error: "text-destructive", warning: "text-warning", info: "text-primary", success: "text-success" }

export function AlertsPanel() {
  const { data, actions } = useQuiz()
  const items = data.notifications.filter((n) => !n.read && (n.level === "error" || n.level === "warning"))
  return (
    <Card>
      <CardHeader>
        <CardTitle>対応が必要な通知</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-3 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            現在、対応が必要な事項はありません
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((n) => {
              const Icon = LEVEL_ICON[n.level]
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => actions.markNotificationRead(n.id)}
                    className="flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", LEVEL_CLASS[n.level])} aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{n.description}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function ActivityPanel() {
  const { data } = useQuiz()
  const items = data.activity.slice(0, 7)
  return (
    <Card>
      <CardHeader>
        <CardTitle>最新の処理履歴</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="処理履歴はまだありません" />
        ) : (
          <ol className="flex flex-col gap-3">
            {items.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatRelative(a.at)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="leading-relaxed">{a.action}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {a.actor}・{a.href ? <Link href={a.href} className="font-mono hover:underline">{a.target}</Link> : <span className="font-mono">{a.target}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

const INTEGRATION_TONE: Record<Integration["status"], { label: string; tone: "warning" | "success" | "muted" | "danger" | "neutral" }> = {
  demo: { label: "デモ", tone: "warning" },
  connected: { label: "接続済み", tone: "success" },
  disconnected: { label: "未接続", tone: "muted" },
  error: { label: "エラー", tone: "danger" },
  unverified: { label: "未確認", tone: "neutral" },
}

export function IntegrationsPanel() {
  const { data, state } = useQuiz()
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI・SNS連携状態</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/settings?tab=integrations" />}>
            設定
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.integrations.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="truncate">{i.name}</span>
              <StatusBadge {...INTEGRATION_TONE[i.status]} hideIcon />
            </li>
          ))}
        </ul>
        <Button variant="outline" className="w-full" render={<a href={state.settings.kpiDashboardUrl} target="_blank" rel="noopener noreferrer" />}>
          Sheets KPIダッシュボードを開く
          <ExternalLink className="size-3.5" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  )
}
