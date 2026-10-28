"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { GenerateForm, type GenerateInitial } from "@/components/generate/generate-form"
import { JobHistory, JobProgress } from "@/components/generate/job-panels"
import { LiveGenerate } from "@/components/generate/live-generate"
import { useQuiz } from "@/lib/store/quiz-store"
import { DEMO_TODAY } from "@/lib/format"
import type { Platform } from "@/lib/types"

function GenerateContent() {
  const params = useSearchParams()
  const { state, data } = useQuiz()
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const initial: GenerateInitial = {
    mode: (["daily", "bulk", "single"] as const).find((m) => m === params.get("mode")),
    platform: (["x", "discord", "instagram"] as Platform[]).find((p) => p === params.get("platform")),
    date: params.get("date") ?? undefined,
  }
  const monthCost = data.jobs
    .filter((j) => j.startedAt.slice(0, 7) === DEMO_TODAY.slice(0, 7) && j.status !== "cancelled")
    .reduce((sum, j) => sum + (j.actualCostJpy ?? j.estimatedCostJpy), 0)
  const job = data.jobs.find((j) => j.id === selectedId) ?? data.jobs.find((j) => j.status === "running") ?? data.jobs[0]

  if (state.settings.dataMode === "live") return <LiveGenerate initialPlatform={initial.platform} similarId={params.get("similar")} />

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <GenerateForm initial={initial} onStarted={setSelectedId} monthCost={monthCost} />
      <div className="flex flex-col gap-6">
        <JobProgress job={job} />
        <JobHistory jobs={data.jobs} selectedId={job?.id} onSelect={setSelectedId} />
      </div>
    </div>
  )
}

export default function GeneratePage() {
  return (
    <>
      <PageHeader title="AI問題生成" description="出題計画と過去の傾向をもとに問題候補を生成し、検証まで自動で行います" />
      <Suspense>
        <GenerateContent />
      </Suspense>
    </>
  )
}
