import { CircleCheck, CircleDashed, CircleAlert, CircleX, Loader, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tone } from "@/lib/constants"

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  info: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-transparent text-muted-foreground",
}

const TONE_ICON: Record<Tone, React.ComponentType<{ className?: string }>> = {
  neutral: Circle,
  info: Loader,
  success: CircleCheck,
  warning: CircleAlert,
  danger: CircleX,
  muted: CircleDashed,
}

/** 状態は色だけでなくアイコン＋テキストで区別する */
export function StatusBadge({ tone, label, className, hideIcon }: { tone: Tone; label: string; className?: string; hideIcon?: boolean }) {
  const Icon = TONE_ICON[tone]
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone], className)}>
      {!hideIcon && <Icon className="size-3.5" aria-hidden />}
      {label}
    </span>
  )
}

export function toneTextClass(tone: Tone) {
  return {
    neutral: "text-foreground",
    info: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    muted: "text-muted-foreground",
  }[tone]
}
