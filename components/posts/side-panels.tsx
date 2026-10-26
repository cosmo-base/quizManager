"use client"

import Link from "next/link"
import { CalendarClock, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DUPLICATE_LEVEL, IMAGE_STATUS } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import type { Question } from "@/lib/types"
import { canSchedule } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { questionHref } from "@/lib/routes"

export function ScheduleQueue({
  questions,
  disabled,
  onSchedule,
}: {
  questions: Question[]
  disabled: boolean
  onSchedule: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" aria-hidden />
          予約待ち
        </CardTitle>
        <CardDescription>承認済みで、まだ投稿予約されていない問題</CardDescription>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">予約待ちの問題はありません</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {questions.map((q) => {
              const check = canSchedule(q)
              return (
                <li key={q.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs">
                    <PlatformMark platform={q.platform} />
                    <Link href={questionHref(q.id)} className="font-mono text-primary hover:underline">
                      {q.id}
                    </Link>
                    <span className="ml-auto tabular-nums text-muted-foreground">{formatDate(q.plannedDate, { weekday: true })}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{q.text}</p>
                  {check.ok ? (
                    <Button size="sm" variant="outline" className="self-start" onClick={() => onSchedule(q.id)} disabled={disabled}>
                      <Send />
                      投稿予約
                    </Button>
                  ) : (
                    <p className="text-xs text-warning">予約不可：{check.reasons.join(" / ")}</p>
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

export function InstagramStock({
  questions,
  minStock,
  disabled,
  onRecord,
}: {
  questions: Question[]
  minStock: number
  disabled: boolean
  onRecord: (id: string) => void
}) {
  const short = questions.length < minStock
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <PlatformMark platform="instagram" />
            Instagramストック
          </span>
          <span className={cn("text-sm tabular-nums", short ? "text-destructive" : "text-muted-foreground")}>
            {questions.length} / 最低{minStock}問
          </span>
        </CardTitle>
        <CardDescription>
          投稿は休止中です。出題可能な状態の問題を蓄積します。
          {short && <span className="text-destructive"> ストックが不足しています。</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ストックがありません。
            <Link href="/generate" className="text-primary hover:underline">
              AI問題生成
            </Link>
            から追加してください。
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-xs">
                  <Link href={questionHref(q.id)} className="font-mono text-primary hover:underline">
                    {q.id}
                  </Link>
                  <span className="ml-auto text-muted-foreground">
                    再検証期限 {q.recheckBy ? formatDate(q.recheckBy) : "—"}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm">{q.text}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <StatusBadge {...IMAGE_STATUS[q.imageStatus]} />
                  {q.duplicate.level !== "none" && <StatusBadge {...DUPLICATE_LEVEL[q.duplicate.level]} />}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onRecord(q.id)} disabled={disabled}>
                    投稿を記録
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
