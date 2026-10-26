import { Database, FlaskConical, Inbox, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLE_LABEL } from "@/lib/constants"
import type { Role } from "@/lib/types"

export function EmptyState({ title, description, action, icon: Icon = Inbox, className }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function LiveEmptyState({ what }: { what: string }) {
  return (
    <EmptyState
      icon={Database}
      title={`${what}を取得できません`}
      description="実APIモードですが、バックエンド（Supabase）が未接続です。接続するとここに実データが表示されます。デモを試す場合は設定からデモモードに切り替えてください。"
    />
  )
}

export function PermissionNote({ role, need }: { role: Role; need: string }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        現在の権限（{ROLE_LABEL[role]}）では{need}できません。
      </span>
    </div>
  )
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded border border-dashed border-warning/60 px-1.5 text-[11px] font-medium text-warning", className)}>
      <FlaskConical className="size-3" aria-hidden />
      サンプル
    </span>
  )
}
