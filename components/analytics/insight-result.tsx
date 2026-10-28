"use client"

import { Check, FlaskConical, Lightbulb, ListChecks, Loader2, TriangleAlert, Wrench, Copy } from "lucide-react"
import { toast } from "sonner"
import type { AIInsight } from "@/lib/types"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { SampleTag } from "@/components/shared/states"
import { SCOPE_LABEL } from "@/components/analytics/insight-form"

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

function Bullets({ items, empty = "該当なし" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
          <span className="text-pretty">{t}</span>
        </li>
      ))}
    </ul>
  )
}

export function InsightResult({ insight }: { insight: AIInsight }) {
  const { state, actions, can } = useQuiz()
  const canApply = can("settings") || can("approve")
  // 実APIモード：生成ルールは正本に無いので、改善案は AI 生成の「追加の指示」に写して使う
  const live = state.settings.dataMode === "live"
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("改善案をコピーしました", { description: "AI問題生成の「追加の指示」に貼り付けて使えます" })
    } catch {
      toast.error("コピーできませんでした")
    }
  }

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-primary">{insight.id}</span>
          <StatusBadge
            tone={insight.status === "completed" ? "success" : insight.status === "running" ? "info" : "danger"}
            label={insight.status === "completed" ? "完了" : insight.status === "running" ? "分析中" : "失敗"}
          />
          {insight.isDemo && <SampleTag />}
        </div>
        <h2 className="text-lg font-semibold text-balance">{insight.targetLabel}</h2>
        <p className="text-xs text-muted-foreground">
          {SCOPE_LABEL[insight.scope]}・<span className="font-mono">{insight.model}</span>・{formatDateTime(insight.createdAt)}
        </p>
      </header>

      {insight.status === "running" && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          回答実績と問題内容を分析しています…
        </div>
      )}

      {insight.status === "failed" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">分析に失敗しました。接続状態を確認して再実行してください。</p>
      )}

      {insight.status === "completed" && (
        <div className="flex flex-col gap-4">
          <Section icon={ListChecks} title="1. データから確認できる事実">
            <Bullets items={insight.facts} />
          </Section>
          <Section icon={Lightbulb} title="2. 考えられる仮説">
            <Bullets items={insight.hypotheses} />
          </Section>
          <Section icon={Wrench} title="3. 具体的な改善案">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {live ? "採用する改善案は、AI問題生成の「追加の指示」に写して使ってください（自動では反映されません）。" : "承認した改善案だけが「設定 > 問題生成ルール」に反映されます。"}
            </p>
            <ul className="flex flex-col gap-2">
              {insight.improvements.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm leading-relaxed text-pretty">{r.text}</span>
                  {live ? (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(r.text)}>
                      <Copy aria-hidden />
                      コピー
                    </Button>
                  ) : r.approved ? (
                    <StatusBadge tone="success" label="ルールに反映済み" className="shrink-0" />
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0" disabled={!canApply} onClick={() => actions.approveInsightRule(insight.id, r.id)}>
                      <Check aria-hidden />
                      承認して反映
                    </Button>
                  )}
                </li>
              ))}
              {!insight.improvements.length && <p className="text-sm text-muted-foreground">該当なし</p>}
            </ul>
          </Section>
          <Section icon={FlaskConical} title="4. 検証方法">
            <Bullets items={insight.verification} />
          </Section>
          <Section icon={TriangleAlert} title="5. 分析上の注意点">
            <Bullets items={insight.cautions} />
          </Section>
        </div>
      )}
    </article>
  )
}
