"use client"

import { PlugZap } from "lucide-react"
import type { Integration } from "@/lib/types"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusBadge } from "@/components/shared/status-badge"
import type { Tone } from "@/lib/constants"

export function SettingsCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SwitchRow({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} disabled={disabled} />
    </div>
  )
}

export function NumberField({ id, label, hint, value, onChange, min = 0, max, suffix, disabled }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; disabled?: boolean }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="w-28 font-mono"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.max(min, max != null ? Math.min(max, n) : n))
          }}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  )
}

export function TimeField({ id, label, hint, value, onChange, disabled }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} type="time" className="w-32 font-mono" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

const STATUS: Record<Integration["status"], { tone: Tone; label: string }> = {
  demo: { tone: "warning", label: "デモ（擬似）" },
  connected: { tone: "success", label: "接続済み" },
  disconnected: { tone: "muted", label: "未接続" },
  error: { tone: "danger", label: "エラー" },
  unverified: { tone: "warning", label: "技術検証中" },
}

/** overrides：本番で名前や説明を差し替える（説明は接続テスト前だけ） */
export function IntegrationList({ keys, overrides }: { keys: Integration["key"][]; overrides?: Partial<Record<Integration["key"], { name?: string; note?: string }>> }) {
  const { data, actions } = useQuiz()
  const items = data.integrations
    .filter((i) => keys.includes(i.key))
    .map((i) => ({ ...i, name: overrides?.[i.key]?.name ?? i.name, note: !i.lastCheckedAt && overrides?.[i.key]?.note ? overrides[i.key]!.note! : i.note }))
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              {i.name}
              <StatusBadge tone={STATUS[i.status].tone} label={STATUS[i.status].label} />
            </span>
            <span className="text-xs text-muted-foreground">
              {i.note}
              {i.lastCheckedAt && `・最終確認 ${formatDateTime(i.lastCheckedAt)}`}
            </span>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => actions.testConnection(i.key)}>
            <PlugZap aria-hidden />
            接続テスト
          </Button>
        </li>
      ))}
    </ul>
  )
}
