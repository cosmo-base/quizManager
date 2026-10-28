"use client"

import { questionHref } from "@/lib/routes"
import Link from "next/link"
import { AlertTriangle, ExternalLink, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { POST_STATUS, RESPONSE_STATUS, SYNC_STATUS } from "@/lib/constants"
import { formatDate, formatTime } from "@/lib/format"
import type { PostJob, Question } from "@/lib/types"

export type PostAction =
  | "preview"
  | "postNow"
  | "reschedule"
  | "cancel"
  | "check"
  | "reveal"
  | "fetch"
  | "manual"
  | "recordManual"

/**
 * 実APIモードで出す操作。予約時刻は 06:00 固定で、取り消しは出題計画（予備に戻す）で行うため出さない。
 * 手動対応は「手動で投稿した URL を記録する」1 段階にする（記録すると投稿済みになる）
 */
export function liveActions(j: PostJob): PostAction[] {
  const base = availableActions(j).filter((a) => a !== "reschedule" && a !== "cancel" && a !== "manual" && a !== "recordManual")
  return j.status === "scheduled" || j.status === "failed" || j.status === "unknown" ? [...base, "recordManual"] : base
}

export function availableActions(j: PostJob): PostAction[] {
  switch (j.status) {
    case "draft":
      return ["preview", "cancel"]
    case "scheduled":
      return ["preview", "postNow", "reschedule", "manual", "cancel"]
    case "posting":
      return ["preview", "check"]
    case "unknown":
      return ["preview", "check", "manual"]
    case "failed":
      return ["preview", "postNow", "manual", "cancel"]
    case "manual":
      return ["preview", "recordManual", "cancel"]
    case "posted":
      return ["preview", ...(j.answerRevealed ? [] : (["reveal"] as PostAction[])), "fetch", "check"]
    default:
      return ["preview"]
  }
}

const ACTION_LABEL: Record<PostAction, string> = {
  preview: "投稿内容プレビュー",
  postNow: "今すぐ投稿",
  reschedule: "予約変更",
  cancel: "投稿取消",
  check: "投稿状況を確認",
  reveal: "正解を発表",
  fetch: "結果を取得",
  manual: "手動対応へ切替",
  recordManual: "手動投稿を記録",
}

export function PostTable({
  jobs,
  questions,
  disabled,
  onAction,
  live = false,
}: {
  jobs: PostJob[]
  questions: Map<string, Question>
  disabled: boolean
  onAction: (job: PostJob, action: PostAction) => void
  live?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">投稿日</TableHead>
            <TableHead className="w-10">媒体</TableHead>
            <TableHead>問題</TableHead>
            <TableHead className="w-28">予定 / 公開</TableHead>
            <TableHead className="w-28">投稿状態</TableHead>
            <TableHead className="w-24">回答取得</TableHead>
            <TableHead className="w-20">同期</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => {
            const q = questions.get(j.questionId)
            const acts = live ? liveActions(j) : availableActions(j)
            return (
              <TableRow key={j.id}>
                <TableCell className="tabular-nums">{formatDate(j.date, { weekday: true })}</TableCell>
                <TableCell>
                  <PlatformMark platform={j.platform} />
                </TableCell>
                <TableCell className="min-w-72 max-w-md whitespace-normal">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Link href={questionHref(j.questionId)} className="font-mono text-primary hover:underline">
                        {j.questionId}
                      </Link>
                      <span className="text-muted-foreground">v{j.questionVersion}</span>
                      {j.url && (
                        <a
                          href={j.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                        >
                          投稿URL
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </div>
                    <span className="truncate text-sm">{q?.text ?? "—"}</span>
                    {j.error && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{j.error}</span>
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  <div className="flex flex-col">
                    <span>{formatTime(j.scheduledAt)}</span>
                    <span className="text-muted-foreground">{j.publishedAt ? formatTime(j.publishedAt) : "未公開"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge {...POST_STATUS[j.status]} />
                  {j.plan && j.status === "scheduled" && (
                    <span className="mt-1 block text-xs text-muted-foreground" title={j.plan.plannedAt ?? undefined}>
                      21:00 固定{j.plan.source === "spare" ? "（予備から）" : ""}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge {...RESPONSE_STATUS[j.responseStatus]} />
                </TableCell>
                <TableCell>
                  <StatusBadge {...SYNC_STATUS[j.syncStatus]} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`${j.id}の操作`} />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {acts.map((a) => (
                        <div key={a} className="contents">
                          {a === "cancel" && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            onClick={() => onAction(j, a)}
                            disabled={a !== "preview" && disabled}
                            variant={a === "cancel" ? "destructive" : "default"}
                          >
                            {ACTION_LABEL[a]}
                          </DropdownMenuItem>
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
