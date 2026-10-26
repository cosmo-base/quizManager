import { cn } from "@/lib/utils"
import type { Platform } from "@/lib/types"
import { PLATFORM_LABEL } from "@/lib/constants"

const MONO: Record<Platform, string> = { x: "X", discord: "DC", instagram: "IG" }

export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-semibold",
        platform === "x" && "bg-foreground text-background",
        platform === "discord" && "bg-primary/15 text-primary",
        platform === "instagram" && "bg-warning/15 text-warning",
        className,
      )}
    >
      {MONO[platform]}
    </span>
  )
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className)}>
      <PlatformMark platform={platform} />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}
