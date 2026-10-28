"use client"

import { useEffect, useState } from "react"
import { BrainCircuit } from "lucide-react"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/states"
import { InsightForm, SCOPE_LABEL } from "@/components/analytics/insight-form"
import { InsightResult } from "@/components/analytics/insight-result"

export default function AnalyticsPage() {
  const { data, state, actions } = useQuiz()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const live = state.settings.dataMode === "live"
  // 実APIモード：開いたときに正本の分析履歴を読む
  useEffect(() => {
    if (live && state.liveStatus.me) void actions.loadLiveInsights()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, state.liveStatus.me?.email])
  const selected = data.insights.find((i) => i.id === selectedId) ?? data.insights[0]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="AI定性分析" description="回答実績をもとに、問題の傾向と改善案をAIが整理します。採用するかは運営者が判断します。" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <InsightForm onStarted={setSelectedId} />

          <section aria-labelledby="insight-history" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <h2 id="insight-history" className="text-sm font-semibold">
              分析履歴
            </h2>
            {data.insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">まだ分析はありません。</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.insights.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(i.id)}
                      aria-current={selected?.id === i.id}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary",
                        selected?.id === i.id && "bg-secondary",
                      )}
                    >
                      <span className="truncate text-sm">{i.targetLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {SCOPE_LABEL[i.scope]}・{formatDateTime(i.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          {selected ? (
            <InsightResult insight={selected} />
          ) : live ? (
            <EmptyState icon={BrainCircuit} title="分析結果はまだありません" description={state.liveStatus.ai?.configured ? "左のフォームから分析対象を選んで実行してください（Gemini を使います）。" : "Gemini が未設定です（GAS の GEMINI_API_KEY）。"} />
          ) : (
            <EmptyState icon={BrainCircuit} title="分析結果はまだありません" description="左のフォームから分析対象を選んで実行してください。" />
          )}
        </div>
      </div>
    </div>
  )
}
