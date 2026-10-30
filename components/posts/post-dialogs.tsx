"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlatformBadge } from "@/components/shared/platform-badge"
import { PLATFORM_LABEL } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { buildDiscordAnswerText, buildDiscordQuestionText, DISCORD_EMOJI, DISCORD_MESSAGE_MAX, overlongDiscordText } from "@/lib/discord-format"
import { buildXAnswerText, buildXPollOptions, buildXQuestionText, overlongXChoices, overlongXText, X_COMMUNITY_TEXT, X_POLL_DURATION_MINUTES, X_POLL_OPTION_MAX, X_TEXT_MAX } from "@/lib/x-poll"
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
          {platform === "x" ? (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{buildXQuestionText(q)}</p>
              <ul className="flex flex-col gap-1.5" aria-label="アンケート選択肢">
                {buildXPollOptions(q).map((o) => (
                  <li key={o} className="rounded-full border border-primary/40 px-4 py-1.5 text-sm text-primary">
                    {o}
                  </li>
                ))}
                {overlongXText(q) !== null && (
                  <li role="alert" className="text-xs text-destructive">
                    本文が {overlongXText(q)} / {X_TEXT_MAX}（全角は 2 と数えます）で長すぎます。投票が付かないため、06:00 には前振りを外して投稿されます。問題を修正して短くしてください
                  </li>
                )}
                {overlongXChoices(q).length > 0 && (
                  <li role="alert" className="text-xs text-destructive">
                    選択肢 {overlongXChoices(q).join("・")} が {X_POLL_OPTION_MAX} 文字（番号込み）を超えています。このままでは投稿できません
                  </li>
                )}
                <li className="text-xs text-muted-foreground">X標準アンケート ・ 投票期間{X_POLL_DURATION_MINUTES}分（翌05:50締切）・ 画像なし</li>
              </ul>
              <div className="flex flex-col gap-1 border-l-2 pl-3">
                <span className="text-xs text-muted-foreground">直後のスレッド返信（コミュニティーへの誘導）</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{X_COMMUNITY_TEXT}</p>
              </div>
              <div className="flex flex-col gap-1 border-l-2 pl-3">
                <span className="text-xs text-muted-foreground">翌朝の引用リポスト（正解・解説）</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{buildXAnswerText(q)}</p>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">当日の問題（問題カードの画像付き）</span>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{buildDiscordQuestionText(q)}</p>
              <ul className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Bot が付けるリアクション">
                {(["A", "B", "C"] as const).map((l) => (
                  <li key={l} className="rounded-full border bg-background px-2.5 py-0.5">
                    {DISCORD_EMOJI[l]} 1
                  </li>
                ))}
              </ul>
              {overlongDiscordText(q) !== null && (
                <p role="alert" className="text-xs text-destructive">
                  メッセージが {overlongDiscordText(q)} 文字あり、Discord の上限（{DISCORD_MESSAGE_MAX} 文字）を超えています。このままでは投稿できません
                </p>
              )}
              <p className="text-xs text-muted-foreground">Bot が 1️⃣2️⃣3️⃣ を付けます（Bot の分・複数選択は集計対象外）・ 翌朝 06:00 の正解発表の直前に締切</p>
              <div className="flex flex-col gap-1 border-l-2 pl-3">
                <span className="text-xs text-muted-foreground">翌朝の正解発表（この問題への返信・正解カードの画像付き。翌日の問題より先に送る）</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{buildDiscordAnswerText(q)}</p>
              </div>
            </>
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
  required = false,
  placeholder = "https://",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  onSubmit: (url: string) => void
  /** URL を必須にする（実APIモードの手動投稿の記録は URL から投稿 ID を取り出す） */
  required?: boolean
  placeholder?: string
}) {
  const [url, setUrl] = useState("")
  const valid = url === "" ? !required : /^https?:\/\/\S+$/.test(url)
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
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!valid}
          />
          {!valid && url !== "" && <p className="text-xs text-destructive">URLの形式が正しくありません</p>}
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
