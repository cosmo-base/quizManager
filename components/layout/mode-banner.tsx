"use client"

import Link from "next/link"
import { FlaskConical, OctagonX, PlugZap, Pause } from "lucide-react"
import { useQuiz, type LiveStatus } from "@/lib/store/quiz-store"

export function ModeBanner() {
  const { state } = useQuiz()
  const { dataMode, emergencyStop, automationPaused, verificationMode } = state.settings

  return (
    <div className="flex flex-col">
      {emergencyStop && (
        <div role="alert" className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-primary-foreground md:px-8">
          <OctagonX className="size-4 shrink-0" aria-hidden />
          緊急停止中：すべての自動投稿・自動生成を停止しています
          <Link href="/settings?tab=automation" className="ml-auto underline underline-offset-2">解除する</Link>
        </div>
      )}
      {!emergencyStop && automationPaused && (
        <div role="status" className="flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning md:px-8">
          <Pause className="size-4 shrink-0" aria-hidden />
          自動処理を一時停止しています（予約投稿・日次生成は実行されません）
        </div>
      )}
      {dataMode === "demo" ? (
        <div className="flex items-center gap-2 border-b border-dashed border-warning/50 bg-warning/5 px-4 py-1.5 text-xs text-warning md:px-8">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">デモモード</strong>
            <span className="hidden sm:inline">：表示中のデータはすべてサンプルです。AI生成・投稿・同期は擬似処理で、外部APIは呼び出しません。</span>
          </span>
          {verificationMode && <span className="ml-auto hidden rounded border border-warning/40 px-1.5 md:inline">検証モード（全件人間確認）</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b bg-muted px-4 py-1.5 text-xs text-muted-foreground md:px-8">
          <PlugZap className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">実APIモード</strong>：
            {state.liveStatus.loadedAt
              ? `正本（Google Sheets）のデータを表示しています。${liveModeText(state.liveStatus)}`
              : "Google でログインすると、正本（Google Sheets）のデータを読み込みます。"}
          </span>
          <Link href="/settings?tab=data" className="ml-auto underline underline-offset-2">接続状態を確認</Link>
        </div>
      )}
    </div>
  )
}

/** 媒体ごとの投稿モード（Discord は Bot が設定済みのときだけ表示） */
function liveModeText(s: LiveStatus): string {
  const mode = (dry: boolean | null) => (dry === false ? "本番投稿" : "ドライラン")
  return s.discordConfigured ? `X：${mode(s.dryRun)}・Discord：${mode(s.discordDryRun)}` : s.dryRun ? "ドライラン中（X には投稿しません）" : "本番投稿モード"
}
