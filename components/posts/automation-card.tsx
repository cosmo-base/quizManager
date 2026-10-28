"use client"

// 実APIモード：毎朝の自動投稿の状態（GAS の getAutomationStatus）
import Link from "next/link"
import { Bot } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Tone } from "@/lib/constants"
import { formatDate, formatDateTime } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import type { GasAutomationStatus, GasPlan, GasPostState } from "@/lib/services/gas-contract"
import { cn } from "@/lib/utils"

const RESULT_TONE: Record<string, Tone> = { done: "success", ok: "success", skip: "muted", error: "danger", notified: "warning" }
const SOURCE_LABEL: Record<string, string> = { cron: "06:00", fallback: "06:10 予備", trigger: "定時", manual: "手動" }
const TASK_LABEL: Record<string, string> = {
  dailyPost: "投稿",
  precheck: "点検",
  heartbeat: "ハートビート",
  reminder: "18:00 確認",
  confirm: "21:00 確定",
  setting: "設定",
}

function QuestionLink({ id, version }: { id: string; version: number }) {
  return (
    <Link href={questionHref(id)} className="font-mono text-primary hover:underline">
      {id} v{version}
    </Link>
  )
}

function PlanLine({ label, date, plan, candidates }: { label: string; date: string; plan: GasPlan | null; candidates: { questionId: string; version: number }[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">
        {label}（{formatDate(date, { weekday: true })} 06:00）
      </dt>
      <dd className="text-sm">
        {plan ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <QuestionLink id={plan.questionId} version={plan.version} />
            <StatusBadge tone={plan.source === "spare" ? "warning" : "success"} label={plan.source === "spare" ? "予備から固定" : "固定済み"} />
          </span>
        ) : candidates.length === 1 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <QuestionLink id={candidates[0].questionId} version={candidates[0].version} />
            <span className="text-xs text-muted-foreground">承認済み（21:00 に固定）</span>
          </span>
        ) : candidates.length > 1 ? (
          <span className="text-destructive">承認済みが {candidates.length} 件あります。1 件にしてください</span>
        ) : (
          <span className="text-warning">未定（21:00 に予備から割り当てます）</span>
        )}
      </dd>
    </div>
  )
}

function PostLine({ label, state, empty }: { label: string; state: GasPostState | null; empty: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {state ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <QuestionLink id={state.questionId} version={state.version} />
            <StatusBadge tone={state.outcome === "success" ? "success" : "danger"} label={state.outcome === "success" ? (state.dryRun ? "記録済み（ドライラン）" : "投稿済み") : "成否不明"} />
          </span>
        ) : (
          <span className="text-muted-foreground">{empty}</span>
        )}
      </dd>
    </div>
  )
}

export function AutomationCard({ status }: { status: GasAutomationStatus | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Bot className="size-4" aria-hidden />
            自動投稿
          </span>
          {status && (
            <span className="flex items-center gap-1.5">
              <StatusBadge tone={status.enabled ? "success" : "warning"} label={status.enabled ? "稼働中" : "停止中"} />
              {status.dryRun && <StatusBadge tone="info" label="ドライラン" />}
            </span>
          )}
        </CardTitle>
        <CardDescription>06:00 に前日の正解発表と当日の投稿。前日 18:00 に確認依頼、21:00 に翌日分を固定します。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!status ? (
          <p className="text-sm text-muted-foreground">状態を取得できていません。Google でログインし、「正本から再読み込み」を押してください。</p>
        ) : (
          <>
            <dl className="flex flex-col gap-3">
              <PlanLine label="明日" date={status.tomorrow} plan={status.tomorrowPlan} candidates={status.tomorrowCandidates} />
              <PostLine label={`今日（${formatDate(status.today, { weekday: true })}）の投稿`} state={status.todayPost} empty="まだありません" />
              <PostLine label="前日分の正解発表" state={status.yesterdayAnswer} empty="まだありません" />
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">予備問題（承認済み・出題日なしの X の問題）</dt>
                <dd className={cn("text-sm tabular-nums", status.spareCount < status.spareMin && "text-warning")}>
                  {status.spareCount} 問{status.spareCount < status.spareMin && `（最低 ${status.spareMin} 問。不足しています）`}
                </dd>
              </div>
            </dl>
            {(!status.notifyConfigured || !status.discordConfigured) && (
              <p className="text-xs text-warning">
                {!status.notifyConfigured && "通知メール（NOTIFY_EMAIL）が未設定です。"}
                {!status.discordConfigured && "Discord の運営用チャンネル（DISCORD_OPS_WEBHOOK_URL）が未設定のため、18:00 の確認依頼はメールで送ります。"}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">直近の実行記録</p>
              {status.recentLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">記録はまだありません</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto text-xs" aria-label="自動投稿の実行記録">
                  {status.recentLog.slice(0, 12).map((l, i) => (
                    <li key={i} className="flex flex-col gap-0.5 rounded border px-2 py-1.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums text-muted-foreground">{l.at ? formatDateTime(l.at) : "—"}</span>
                        <span>{SOURCE_LABEL[l.source] ?? l.source}</span>
                        <span className="text-muted-foreground">{TASK_LABEL[l.task] ?? l.task}・{l.step}</span>
                        <StatusBadge tone={RESULT_TONE[l.result] ?? "neutral"} label={l.result} />
                      </span>
                      {l.message && <span className="break-all text-muted-foreground">{l.message}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
