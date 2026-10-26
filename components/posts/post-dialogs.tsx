"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { PLATFORM_LABEL } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import type { Platform, Question } from "@/lib/types"

export function PostPreviewDialog({
  q,
  platform,
  open,
  onOpenChange,
}: {
  q: Question | null
  platform: Platform
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  if (!q) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>投稿内容プレビュー</DialogTitle>
          <DialogDescription>
            {PLATFORM_LABEL[platform]}に投稿される内容です（{q.id} / v{q.confirmedVersion ?? q.versions.length}）
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={platform} />
            <span className="text-xs text-muted-foreground">{formatDate(q.plannedDate, { weekday: true })}</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.text}</p>
          {platform === "x" ? (
            <ul className="flex flex-col gap-1.5" aria-label="アンケート選択肢">
              {q.choices.map((c) => (
                <li key={c.label} className="rounded-full border border-primary/40 px-4 py-1.5 text-sm text-primary">
                  {c.text}
                </li>
              ))}
              <li className="text-xs text-muted-foreground">X標準アンケート ・ 投票期間24時間</li>
            </ul>
          ) : (
            <ul className="flex flex-col gap-1 text-sm" aria-label="リアクション選択肢">
              {q.choices.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded border bg-background font-mono text-xs font-semibold">
                    {c.label}
                  </span>
                  {c.text}
                </li>
              ))}
              <li className="text-xs text-muted-foreground">リアクションで回答（Botのリアクションは集計対象外）</li>
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RescheduleDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: string
  onSubmit: (time: string) => void
}) {
  const [time, setTime] = useState(initial)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>予約時刻を変更</DialogTitle>
          <DialogDescription>日本時間で指定します。前日の正解発表より後の時刻にしてください。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reschedule-time">投稿時刻</Label>
          <Input id="reschedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={!time}
            onClick={() => {
              onSubmit(time)
              onOpenChange(false)
            }}
          >
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RecordUrlDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  onSubmit: (url: string) => void
}) {
  const [url, setUrl] = useState("")
  const valid = url === "" || /^https?:\/\/\S+$/.test(url)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-url">投稿URL</Label>
          <Input
            id="post-url"
            type="url"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!valid}
          />
          {!valid && <p className="text-xs text-destructive">URLの形式が正しくありません</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSubmit(url.trim())
              setUrl("")
              onOpenChange(false)
            }}
          >
            記録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
