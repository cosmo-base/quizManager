"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCheck, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/states"
import { QUEUE_FILTERS, ReviewQueue, matchesQueue, type QueueFilter } from "@/components/reviews/review-queue"
import { ReviewPanel } from "@/components/reviews/review-panel"
import { useQuiz } from "@/lib/store/quiz-store"
import { can } from "@/lib/validation"
import { cn } from "@/lib/utils"

function ReviewsContent() {
  const { state, data, actions } = useQuiz()
  const router = useRouter()
  const params = useSearchParams()
  const [filter, setFilter] = useState<QueueFilter>("review")
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const verificationMode = state.settings.verificationMode
  const items = useMemo(
    () =>
      data.questions
        .filter((q) => matchesQueue(q, filter))
        .sort((a, b) => (a.plannedDate ?? "9999").localeCompare(b.plannedDate ?? "9999")),
    [data.questions, filter],
  )
  const counts = useMemo(
    () => Object.fromEntries(QUEUE_FILTERS.map((f) => [f.value, data.questions.filter((q) => matchesQueue(q, f.value)).length])),
    [data.questions],
  )

  const paramId = params.get("q")
  const selectedId = items.some((q) => q.id === paramId) ? paramId : (items[0]?.id ?? null)
  const selected = data.questions.find((q) => q.id === selectedId) ?? null
  const bulkEnabled = !verificationMode && can(state.role, "approve")
  const checkedIds = [...checked].filter((id) => items.some((q) => q.id === id && q.autoApprovable))

  const select = (id: string) => router.replace(`/reviews?q=${id}`, { scroll: false })
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const bulkApprove = () => {
    checkedIds.forEach((id) => actions.approve(id, "一括承認（自動承認候補）"))
    setChecked(new Set())
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="確認・承認" description="AIの検証結果と出典を見比べて、問題を承認・修正・差し戻します" />

      {verificationMode && (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
          <ShieldAlert className="size-4 shrink-0 text-info" aria-hidden />
          <span>検証モード中のため、自動承認と一括承認は無効です。すべての問題を人間が確認してください。</span>
        </div>
      )}

      <div className="grid h-[calc(100dvh-14rem)] min-h-[32rem] grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div role="tablist" aria-label="絞り込み" className="flex border-b">
            {QUEUE_FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                type="button"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium",
                  filter === f.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                <span className="rounded bg-muted px-1.5 tabular-nums">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          {bulkEnabled && filter !== "returned" && (
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <span>自動承認候補のみ選択可</span>
              <Button size="sm" onClick={bulkApprove} disabled={checkedIds.length === 0}>
                <CheckCheck />
                一括承認（{checkedIds.length}）
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ReviewQueue
              items={items}
              selectedId={selectedId}
              onSelect={select}
              checked={checked}
              onToggle={toggle}
              bulkEnabled={bulkEnabled && filter !== "returned"}
            />
          </div>
        </aside>
        <section className="min-h-0" aria-label="問題の確認">
          {selected ? (
            <ReviewPanel key={selected.id} q={selected} />
          ) : (
            <EmptyState title="確認待ちの問題はありません" description="新しい問題が生成されるとここに表示されます" />
          )}
        </section>
      </div>
    </div>
  )
}

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsContent />
    </Suspense>
  )
}
