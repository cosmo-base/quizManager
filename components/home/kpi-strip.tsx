"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PlatformMark } from "@/components/shared/platform-badge"
import type { Platform } from "@/lib/types"

interface Kpi {
  label: string
  value: string
  sub: string
  href: string
  tone?: "warning" | "danger" | "ok"
  platform?: Platform
}

export function KpiStrip() {
  const { data, state } = useQuiz()

  const kpis = useMemo<Kpi[]>(() => {
    const nextOf = (p: Platform) =>
      data.postJobs.filter((j) => j.platform === p && j.status === "scheduled").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
    const nx = nextOf("x")
    const nd = nextOf("discord")
    const igStock = data.questions.filter((q) => q.platform === "instagram" && q.status === "approved").length
    const review = data.questions.filter((q) => q.status === "review" || q.status === "returned").length
    const unaggregated = data.postJobs.filter((j) => j.status === "posted" && j.responseStatus !== "finalized").length
    const failed = data.postJobs.filter((j) => j.status === "failed" || j.status === "unknown").length
    const minStock = state.settings.posting.instagramMinStock
    return [
      { label: "次回X出題", value: nx ? formatDateTime(nx.scheduledAt) : "予約なし", sub: nx ? nx.questionId : "出題計画を確認", href: "/posts", platform: "x" },
      { label: "次回Discord出題", value: nd ? formatDateTime(nd.scheduledAt) : "予約なし", sub: nd ? nd.questionId : "出題計画を確認", href: "/posts", platform: "discord" },
      { label: "Instagramストック", value: `${igStock}問`, sub: igStock < minStock ? `最低${minStock}問を下回っています` : `最低${minStock}問・投稿休止中`, href: "/questions?platform=instagram", platform: "instagram", tone: igStock < minStock ? "warning" : undefined },
      { label: "確認・承認待ち", value: `${review}件`, sub: review ? "確認が必要です" : "対応不要", href: "/reviews", tone: review ? "warning" : "ok" },
      { label: "未集計", value: `${unaggregated}件`, sub: unaggregated ? "回答結果の取得待ち" : "すべて集計済み", href: "/posts?tab=results", tone: unaggregated ? undefined : "ok" },
      { label: "投稿失敗・不明", value: `${failed}件`, sub: failed ? "詳細を確認してください" : "エラーなし", href: "/posts?status=failed", tone: failed ? "danger" : "ok" },
    ]
  }, [data, state.settings.posting.instagramMinStock])

  return (
    <section aria-label="主要指標" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <Link key={k.label} href={k.href} className="group flex flex-col gap-1.5 bg-card p-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {k.platform && <PlatformMark platform={k.platform} className="size-4 text-[9px]" />}
            {k.label}
          </span>
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums tracking-tight md:text-xl",
              k.tone === "danger" && "text-destructive",
              k.tone === "warning" && "text-warning",
            )}
          >
            {k.value}
          </span>
          <span className={cn("truncate text-xs", k.tone === "ok" ? "text-success" : "text-muted-foreground")}>{k.sub}</span>
        </Link>
      ))}
    </section>
  )
}
