"use client"

import Link from "next/link"
import { ClipboardCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { useQuiz } from "@/lib/store/quiz-store"
import { KpiStrip } from "@/components/home/kpi-strip"
import { TodayPanel, YesterdayPanel } from "@/components/home/today-panel"
import { StockPanel, WeekPanel } from "@/components/home/week-panel"
import { ActivityPanel, AlertsPanel, IntegrationsPanel, JobsPanel } from "@/components/home/ops-panels"
import { LiveActivityPanel, LiveAlertsPanel, LiveTodayPanel } from "@/components/home/live-panels"

export default function HomePage() {
  const { state } = useQuiz()
  const live = state.settings.dataMode === "live"

  return (
    <>
      <PageHeader
        title="今日の運営状況"
        description="出題予定・確認待ち・投稿エラーをひと目で把握します"
        actions={
          <>
            <Button variant="outline" render={<Link href="/reviews" />}>
              <ClipboardCheck className="size-4" aria-hidden />
              確認待ちを開く
            </Button>
            <Button render={<Link href="/generate" />}>
              <Sparkles className="size-4" aria-hidden />
              問題を生成
            </Button>
          </>
        }
      />
      <KpiStrip />
      {live ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <LiveTodayPanel />
              <WeekPanel />
            </div>
            <div className="flex flex-col gap-6">
              <LiveAlertsPanel />
              <YesterdayPanel />
              <StockPanel />
            </div>
          </div>
          <LiveActivityPanel />
        </>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <TodayPanel />
              <WeekPanel />
            </div>
            <div className="flex flex-col gap-6">
              <YesterdayPanel />
              <StockPanel />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <AlertsPanel />
            <JobsPanel />
            <ActivityPanel />
          </div>
        </>
      )}
      <IntegrationsPanel />
    </>
  )
}
