"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import { addDays, DEMO_TODAY, formatDate, formatPercent, formatTime } from "@/lib/format"
import { PLAN_STATUS, POST_STATUS, RESPONSE_STATUS } from "@/lib/constants"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/states"

export function TodayPanel() {
  const { data } = useQuiz()
  const categoryName = useCategoryName()
  const slots = data.slots.filter((s) => s.date === DEMO_TODAY && s.platform !== "instagram")

  return (
    <Card>
      <CardHeader>
        <CardTitle>本日の出題予定</CardTitle>
        <p className="text-sm text-muted-foreground">{formatDate(DEMO_TODAY, { weekday: true, year: true })}</p>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/calendar" />}>
            出題計画を開く
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <EmptyState title="本日の出題枠はありません" description="出題計画カレンダーで出題枠を追加できます" />
        ) : (
          <ul className="flex flex-col divide-y">
            {slots.map((slot) => {
              const q = data.questions.find((x) => x.id === slot.questionId)
              const job = data.postJobs.find((j) => j.questionId === slot.questionId && j.status !== "cancelled")
              return (
                <li key={slot.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={slot.platform} />
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">{job ? formatTime(job.scheduledAt) : slot.time}</span>
                    <span className="text-xs text-muted-foreground">{categoryName(slot.categoryId)}</span>
                    <span className="ml-auto">
                      {job ? <StatusBadge {...POST_STATUS[job.status]} /> : <StatusBadge {...PLAN_STATUS[slot.status]} />}
                    </span>
                  </div>
                  {q ? (
                    <Link href={`/questions/${q.id}`} className="line-clamp-2 text-sm leading-relaxed hover:underline">
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{q.id}</span>
                      {q.text}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">問題が未割り当てです</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function YesterdayPanel() {
  const { data } = useQuiz()
  const yesterday = addDays(DEMO_TODAY, -1)
  const jobs = data.postJobs.filter((j) => j.date === yesterday && j.platform !== "instagram")

  return (
    <Card>
      <CardHeader>
        <CardTitle>前日の出題・集計結果</CardTitle>
        <p className="text-sm text-muted-foreground">{formatDate(yesterday, { weekday: true })}</p>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <EmptyState title="前日の投稿はありません" />
        ) : (
          <ul className="flex flex-col divide-y">
            {jobs.map((j) => {
              const q = data.questions.find((x) => x.id === j.questionId)
              const r = q?.responses.find((x) => x.postJobId === j.id)
              return (
                <li key={j.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={j.platform} />
                    <StatusBadge {...RESPONSE_STATUS[j.responseStatus]} />
                    <Link href={`/questions/${j.questionId}`} className="ml-auto font-mono text-xs text-muted-foreground hover:underline">
                      {j.questionId}
                    </Link>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">回答数</dt>
                      <dd className="font-mono tabular-nums">{r?.responses ?? "未取得"}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">正答率</dt>
                      <dd className="font-mono tabular-nums">{formatPercent(r?.correct, r?.responses)}</dd>
                    </div>
                    <div className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">{j.platform === "x" ? "インプレッション" : "有効回答者"}</dt>
                      <dd className="font-mono tabular-nums">{(j.platform === "x" ? r?.impressions : r?.uniqueVoters)?.toLocaleString("ja-JP") ?? "未取得"}</dd>
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
