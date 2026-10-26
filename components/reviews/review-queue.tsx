"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DUPLICATE_LEVEL, FACTCHECK_STATUS } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import type { Question } from "@/lib/types"
import { cn } from "@/lib/utils"

export type QueueFilter = "review" | "auto" | "returned"

export const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "review", label: "確認待ち" },
  { value: "auto", label: "自動承認候補" },
  { value: "returned", label: "差し戻し" },
]

export function matchesQueue(q: Question, f: QueueFilter) {
  if (f === "returned") return q.status === "returned"
  if (q.status !== "review") return false
  return f === "auto" ? q.autoApprovable : true
}

export function ReviewQueue({
  items,
  selectedId,
  onSelect,
  checked,
  onToggle,
  bulkEnabled,
}: {
  items: Question[]
  selectedId: string | null
  onSelect: (id: string) => void
  checked: Set<string>
  onToggle: (id: string) => void
  bulkEnabled: boolean
}) {
  if (items.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">該当する問題はありません</p>
  }
  return (
    <ul className="flex flex-col divide-y" aria-label="確認対象の問題">
      {items.map((q) => {
        const active = q.id === selectedId
        return (
          <li key={q.id} className={cn("relative flex gap-3 px-3 py-3", active ? "bg-accent" : "hover:bg-muted/50")}>
            {bulkEnabled && (
              <Checkbox
                className="relative z-10 mt-0.5"
                checked={checked.has(q.id)}
                onCheckedChange={() => onToggle(q.id)}
                disabled={!q.autoApprovable}
                aria-label={`${q.id}を一括承認に含める`}
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              aria-current={active ? "true" : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5 text-left after:absolute after:inset-0"
            >
              <div className="flex items-center gap-2 text-xs">
                <PlatformMark platform={q.platform} />
                <span className="font-mono text-muted-foreground">{q.id}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {q.plannedDate ? formatDate(q.plannedDate) : "日付未定"}
                </span>
              </div>
              <p className="line-clamp-2 text-sm leading-snug">{q.text}</p>
              <div className="flex flex-wrap gap-1">
                <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
                {q.duplicate.level !== "none" && <StatusBadge {...DUPLICATE_LEVEL[q.duplicate.level]} />}
                {q.autoApprovable && <StatusBadge label="自動承認可" tone="success" />}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
