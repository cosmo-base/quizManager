"use client"

// 実APIモード：実際に投稿される本文を出す（X は本文＋①②③の投票＋コミュニティーへの誘導の返信、Discord は問題の本文。カード画像は別に出す）。
import { buildDiscordQuestionText } from "@/lib/discord-format"
import { buildXPollOptions, buildXQuestionText, overlongXChoices, X_COMMUNITY_TEXT, X_POLL_OPTION_MAX } from "@/lib/x-poll"
import type { Question } from "@/lib/types"

export function PostTextPreview({ q }: { q: Question }) {
  if (q.platform === "discord") {
    return <p className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">{buildDiscordQuestionText(q)}</p>
  }
  const tooLong = overlongXChoices(q)
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{buildXQuestionText(q)}</p>
      <ul className="flex flex-col gap-1.5" aria-label="投票の選択肢">
        {buildXPollOptions(q).map((o) => (
          <li key={o} className="rounded-full border border-primary/40 px-3 py-1 text-sm text-primary">
            {o}
          </li>
        ))}
      </ul>
      {tooLong.length > 0 && (
        <p role="alert" className="text-xs text-destructive">
          選択肢 {tooLong.join("・")} が {X_POLL_OPTION_MAX} 文字（番号込み）を超えています
        </p>
      )}
      <div className="flex flex-col gap-1 border-l-2 pl-3">
        <span className="text-xs text-muted-foreground">直後のスレッド返信</span>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{X_COMMUNITY_TEXT}</p>
      </div>
    </div>
  )
}
