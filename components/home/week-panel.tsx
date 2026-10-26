"use client"

import Link from "next/link"
import { CheckCircle2, CircleDashed, CircleX, Clock, HelpCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuiz } from "@/lib/store/quiz-store"
import { addDays, dateRange, DEMO_TODAY, formatDate } from "@/lib/format"
import { PLATFORM_LABEL, POST_STATUS, WEEKDAY_LABEL } from "@/lib/constants"
import { weekday } from "@/lib/format"
import { PlatformMark } from "@/components/shared/platform-badge"
import type { Platform, PostJob } from "@/lib/types"
import { cn } from "@/lib/utils"
import { questionHref } from "@/lib/routes"

function cellFor(job: PostJob | undefined) {
  if (!job) return { icon: CircleDashed, cls: "text-muted-foreground/50", label: "投稿なし" }
  if (job.status === "posted") return { icon: CheckCircle2, cls: "text-success", label: POST_STATUS.posted.label }
  if (job.status === "failed") return { icon: CircleX, cls: "text-destructive", label: POST_STATUS.failed.label }
  if (job.status === "unknown" || job.status === "manual") return { icon: HelpCircle, cls: "text-warning", label: POST_STATUS[job.status].label }
  return { icon: Clock, cls: "text-primary", label: POST_STATUS[job.status].label }
}

export function WeekPanel() {
  const { data } = useQuiz()
  const days = dateRange(addDays(DEMO_TODAY, -6), DEMO_TODAY)
  const platforms: Platform[] = ["x", "discord"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>直近7日間の投稿状況</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full table-fixed text-center text-sm">
          <caption className="sr-only">直近7日間の媒体別投稿状況</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 pb-2 text-left text-xs font-normal text-muted-foreground">
                媒体
              </th>
              {days.map((d) => (
                <th key={d} scope="col" className={cn("pb-2 text-xs font-normal", d === DEMO_TODAY ? "text-foreground" : "text-muted-foreground")}>
                  <span className="block font-mono tabular-nums">{Number(d.slice(8))}</span>
                  <span className="block">{WEEKDAY_LABEL[weekday(d)]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <PlatformMark platform={p} />
                    <span className="hidden sm:inline">{PLATFORM_LABEL[p]}</span>
                  </span>
                </th>
                {days.map((d) => {
                  const job = data.postJobs.find((j) => j.platform === p && j.date === d && j.status !== "cancelled")
                  const c = cellFor(job)
                  const Icon = c.icon
                  const content = (
                    <>
                      <Icon className={cn("mx-auto size-5", c.cls)} aria-hidden />
                      <span className="sr-only">{`${formatDate(d)} ${PLATFORM_LABEL[p]}：${c.label}`}</span>
                    </>
                  )
                  return (
                    <td key={d} className="py-1.5" title={`${formatDate(d)}：${c.label}`}>
                      {job ? (
                        <Link href={questionHref(job.questionId)} className="inline-flex rounded p-1 hover:bg-accent">
                          {content}
                        </Link>
                      ) : (
                        <span className="inline-flex p-1">{content}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="凡例">
          <li className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-success" aria-hidden />投稿済み</li>
          <li className="inline-flex items-center gap-1"><Clock className="size-3.5 text-primary" aria-hidden />予約・処理中</li>
          <li className="inline-flex items-center gap-1"><HelpCircle className="size-3.5 text-warning" aria-hidden />不明・手動</li>
          <li className="inline-flex items-center gap-1"><CircleX className="size-3.5 text-destructive" aria-hidden />失敗</li>
        </ul>
      </CardContent>
    </Card>
  )
}

export function StockPanel() {
  const { data, state } = useQuiz()
  const platforms: Platform[] = ["x", "discord", "instagram"]
  const rows = platforms.map((p) => {
    const approved = data.questions.filter((q) => q.platform === p && q.status === "approved")
    const unassigned = approved.filter((q) => !q.plannedDate).length
    const review = data.questions.filter((q) => q.platform === p && (q.status === "review" || q.status === "returned")).length
    return { p, approved: approved.length, unassigned, review }
  })
  const max = Math.max(1, ...rows.map((r) => r.approved + r.review))

  return (
    <Card>
      <CardHeader>
        <CardTitle>生成済み問題のストック</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.p} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm">
              <PlatformMark platform={r.p} />
              {PLATFORM_LABEL[r.p]}
              <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                確定 {r.approved}・未割当 {r.unassigned}・確認待ち {r.review}
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${PLATFORM_LABEL[r.p]}：確定${r.approved}問、確認待ち${r.review}問`}>
              <div className="h-full bg-success" style={{ width: `${(r.approved / max) * 100}%` }} />
              <div className="h-full bg-warning" style={{ width: `${(r.review / max) * 100}%` }} />
            </div>
            {r.p === "instagram" && r.approved < state.settings.posting.instagramMinStock && (
              <p className="text-xs text-warning">最低ストック数（{state.settings.posting.instagramMinStock}問）を下回っています</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
