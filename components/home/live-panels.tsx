"use client"

// 実APIモードのホーム：今日・明日の出題、要対応、自動投稿の実行記録（正本の Sheets と GAS の自動投稿の状態から）。
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, OctagonAlert } from "lucide-react"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/states"
import { POST_STATUS, ROLE_LABEL, type Tone } from "@/lib/constants"
import { addDays, formatDate, formatDateTime } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import type { GasPlatformAutomation } from "@/lib/services/gas-contract"
import { useQuiz, useToday } from "@/lib/store/quiz-store"
import type { Platform, PostJob, Question } from "@/lib/types"
import { cn } from "@/lib/utils"

type LivePlatform = Exclude<Platform, "instagram">

/** 自動投稿の状態から、媒体ごとの予定（X は最上位の項目、Discord は discord） */
function usePlatformAutomation(): Partial<Record<LivePlatform, GasPlatformAutomation>> {
  const { state } = useQuiz()
  const a = state.liveStatus.automation
  if (!a) return {}
  const x: GasPlatformAutomation = {
    dryRun: a.dryRun,
    todayPlan: a.todayPlan,
    tomorrowPlan: a.tomorrowPlan,
    todayCandidates: a.todayCandidates,
    tomorrowCandidates: a.tomorrowCandidates,
    todayPost: a.todayPost,
    yesterdayAnswer: a.yesterdayAnswer,
    spareCount: a.spareCount,
  }
  return a.discord ? { x, discord: a.discord } : { x }
}

function useLivePlatforms(): LivePlatform[] {
  const { state } = useQuiz()
  return state.liveStatus.discordConfigured ? ["x", "discord"] : ["x"]
}

function QuestionLine({ q, id }: { q?: Question; id: string }) {
  return (
    <Link href={questionHref(id)} className="line-clamp-2 text-sm leading-relaxed hover:underline">
      <span className="mr-2 font-mono text-xs text-muted-foreground">{id}</span>
      {q?.text ?? "（問題が見つかりません）"}
    </Link>
  )
}

/** その日の媒体ごとの出題：投稿の記録 → 21:00 の固定 → 承認済みの候補 の順に見る */
function DayRows({ date, which }: { date: string; which: "today" | "tomorrow" }) {
  const { data } = useQuiz()
  const platforms = useLivePlatforms()
  const auto = usePlatformAutomation()
  return (
    <ul className="flex flex-col divide-y">
      {platforms.map((p) => {
        const job: PostJob | undefined = data.postJobs.find((j) => j.platform === p && j.date === date && j.status !== "cancelled" && j.status !== "scheduled")
        const a = auto[p]
        const plan = which === "today" ? a?.todayPlan : a?.tomorrowPlan
        const candidates = (which === "today" ? a?.todayCandidates : a?.tomorrowCandidates) ?? []
        const qid = job?.questionId ?? plan?.questionId ?? (candidates.length === 1 ? candidates[0].questionId : null)
        let badge: { tone: Tone; label: string }
        if (job) badge = POST_STATUS[job.status]
        else if (plan) badge = { tone: plan.source === "spare" ? "warning" : "success", label: plan.source === "spare" ? "予備から固定" : "固定済み" }
        else if (candidates.length === 1) badge = { tone: "info", label: which === "tomorrow" ? "承認済み（21:00 に固定）" : "承認済み" }
        else if (candidates.length > 1) badge = { tone: "danger", label: `承認済みが ${candidates.length} 件` }
        else badge = { tone: "warning", label: which === "tomorrow" ? "未定（21:00 に予備を割り当て）" : "未定" }
        return (
          <li key={p} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={p} />
              <span className="font-mono text-sm tabular-nums text-muted-foreground">06:00</span>
              {job?.url && (
                <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  投稿を開く
                </a>
              )}
              <span className="ml-auto">
                <StatusBadge {...badge} />
              </span>
            </div>
            {qid ? <QuestionLine id={qid} q={data.questions.find((x) => x.id === qid)} /> : <p className="text-sm text-muted-foreground">出題する問題が決まっていません</p>}
          </li>
        )
      })}
    </ul>
  )
}

export function LiveTodayPanel() {
  const today = useToday()
  const tomorrow = addDays(today, 1)
  return (
    <Card>
      <CardHeader>
        <CardTitle>今日・明日の出題</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/posts" />}>
            投稿管理を開く
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section className="flex flex-col gap-2" aria-label="今日の出題">
          <h3 className="text-xs font-medium text-muted-foreground">今日 {formatDate(today, { weekday: true })}</h3>
          <DayRows date={today} which="today" />
        </section>
        <section className="flex flex-col gap-2" aria-label="明日の出題">
          <h3 className="text-xs font-medium text-muted-foreground">明日 {formatDate(tomorrow, { weekday: true })}</h3>
          <DayRows date={tomorrow} which="tomorrow" />
        </section>
      </CardContent>
    </Card>
  )
}

export interface LiveNotice {
  key: string
  tone: "danger" | "warning"
  text: string
  href: string
}

/** 実APIモードの「要対応」。ホームの要対応欄とヘッダーの通知で同じものを出す */
export function useLiveNotices(): LiveNotice[] {
  const { data, state } = useQuiz()
  const auto = state.liveStatus.automation
  const ai = state.liveStatus.ai
  const me = state.liveStatus.me
  const notices: LiveNotice[] = []
  data.postJobs
    .filter((j) => j.status === "failed" || j.status === "unknown")
    .forEach((j) => notices.push({ key: j.id, tone: j.status === "unknown" ? "danger" : "warning", text: `${formatDate(j.date)} の${j.platform === "x" ? " X" : " Discord"} の投稿が${j.status === "unknown" ? "成否不明です（投稿先で有無を確認してください）" : "失敗しています"}`, href: "/posts" }))
  data.postJobs
    .filter((j) => j.status === "scheduled" && j.plan && j.error)
    .forEach((j) => notices.push({ key: `plan-${j.id}`, tone: "danger", text: `${formatDate(j.date)} の${j.platform === "x" ? " X" : " Discord"}：${j.error}`, href: "/posts" }))
  const review = data.questions.filter((q) => q.status === "review" || q.status === "returned").length
  if (review) notices.push({ key: "review", tone: "warning", text: `確認・承認待ちの問題が ${review} 件あります`, href: "/reviews" })
  if (auto && !auto.enabled) notices.push({ key: "auto-off", tone: "warning", text: "毎朝の自動投稿が停止中です", href: "/posts" })
  ;(auto?.recentLog ?? [])
    .filter((l) => l.result === "error")
    .slice(0, 3)
    .forEach((l, i) => notices.push({ key: `log-${i}`, tone: "danger", text: `${l.at ? formatDateTime(l.at) : ""} 自動処理のエラー：${l.message}`, href: "/posts" }))
  if (auto) {
    const spareLow = [{ p: "X", n: auto.spareCount }, ...(auto.discord ? [{ p: "Discord", n: auto.discord.spareCount }] : [])].filter((x) => x.n < auto.spareMin)
    if (spareLow.length) notices.push({ key: "spare", tone: "warning", text: `予備問題が最低数（${auto.spareMin} 問）を下回っています：${spareLow.map((x) => `${x.p} ${x.n} 問`).join("・")}`, href: "/generate" })
  }
  if (ai?.configured && ai.monthCostJpy >= ai.budgetJpy * 0.8) notices.push({ key: "ai", tone: ai.monthCostJpy >= ai.budgetJpy ? "danger" : "warning", text: `AI の今月の使用量が上限の ${Math.round((ai.monthCostJpy / ai.budgetJpy) * 100)}% です`, href: "/generate" })
  if (me?.pendingRequest) notices.push({ key: "role", tone: "warning", text: `${ROLE_LABEL[me.pendingRequest.role]}への権限の申請が承認待ちです`, href: "/settings?tab=users" })
  return notices
}

export function LiveAlertsPanel() {
  const alerts = useLiveNotices()

  return (
    <Card>
      <CardHeader>
        <CardTitle>要対応</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            対応が必要なことはありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="要対応の一覧">
            {alerts.map((a) => {
              const Icon = a.tone === "danger" ? OctagonAlert : AlertTriangle
              return (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-destructive" : "text-warning")} aria-hidden />
                    <span className="break-all">{a.text}</span>
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

const RESULT_TONE: Record<string, Tone> = { done: "success", ok: "success", skip: "muted", error: "danger", notified: "warning", start: "info" }
const TASK_LABEL: Record<string, string> = { dailyPost: "投稿", generate: "AI 自動生成", precheck: "点検", heartbeat: "ハートビート", reminder: "18:00 確認", confirm: "21:00 確定", setting: "設定" }

export function LiveActivityPanel() {
  const { state } = useQuiz()
  const logs = state.liveStatus.automation?.recentLog ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle>自動処理の記録</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState title="記録はまだありません" />
        ) : (
          <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto text-xs" aria-label="自動処理の記録">
            {logs.slice(0, 15).map((l, i) => (
              <li key={i} className="flex flex-col gap-0.5 rounded border px-2 py-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular-nums text-muted-foreground">{l.at ? formatDateTime(l.at) : "—"}</span>
                  <span className="text-muted-foreground">
                    {TASK_LABEL[l.task] ?? l.task}・{l.step}
                  </span>
                  <StatusBadge tone={RESULT_TONE[l.result] ?? "neutral"} label={l.result} />
                </span>
                {l.message && <span className="break-all text-muted-foreground">{l.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
