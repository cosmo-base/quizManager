"use client"

import { PLAN_STATUS } from "@/lib/constants"
import { toneTextClass } from "@/components/shared/status-badge"
import { PlatformMark } from "@/components/shared/platform-badge"
import { cn } from "@/lib/utils"
import type { PlanSlot } from "@/lib/types"
import { DEMO_TODAY } from "@/lib/format"

export const LOCKED_STATUSES = ["posted", "aggregated", "failed"] as const

export function isSlotMovable(slot: PlanSlot) {
  return !LOCKED_STATUSES.includes(slot.status as (typeof LOCKED_STATUSES)[number]) && slot.date > DEMO_TODAY
}

export function SlotChip({ slot, compact, draggable }: { slot: PlanSlot; compact?: boolean; draggable?: boolean }) {
  const st = PLAN_STATUS[slot.status]
  return (
    <span
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/slot-id", slot.id)
        e.dataTransfer.effectAllowed = "move"
        e.stopPropagation()
      }}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded border bg-background px-1 py-0.5 text-[11px] leading-tight",
        draggable && "cursor-grab active:cursor-grabbing",
        slot.priority === "high" && "border-warning/60",
      )}
      title={`${st.label}${slot.questionId ? `・${slot.questionId}` : ""}${draggable ? "（ドラッグで移動）" : ""}`}
    >
      <PlatformMark platform={slot.platform} className="size-3.5 shrink-0 text-[8px]" />
      <span className={cn("truncate font-medium", toneTextClass(st.tone))}>{st.label}</span>
      {!compact && slot.questionId && <span className="ml-auto hidden truncate font-mono text-muted-foreground xl:inline">{slot.questionId.slice(-4)}</span>}
    </span>
  )
}
