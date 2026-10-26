"use client"

import { useMemo, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import type { AIInsight, Platform } from "@/lib/types"
import { useQuiz } from "@/lib/store/quiz-store"
import { AI_MODELS, PLATFORM_LABEL } from "@/lib/constants"
import { addDays, DEMO_TODAY } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select"
import { PermissionNote } from "@/components/shared/states"

export const SCOPE_LABEL: Record<AIInsight["scope"], string> = {
  question: "特定問題",
  questions: "複数問題（出題済み全体）",
  category: "特定分類",
  platform: "特定媒体",
  period: "指定期間",
  certification: "検定候補問題",
}

const ANALYSIS_ITEMS = [
  "問題の特徴",
  "回答されやすい／されにくい問題の共通点",
  "選択肢の妥当性",
  "難易度の適切さ",
  "媒体適合性",
  "改善案と次回生成の推奨条件",
]

const PLATFORMS: Platform[] = ["x", "discord", "instagram"]

export function InsightForm({ onStarted }: { onStarted: (id: string) => void }) {
  const { data, state, actions, can } = useQuiz()
  const posted = useMemo(() => data.questions.filter((q) => q.responses.length > 0), [data.questions])

  const optionsFor = (scope: AIInsight["scope"]): SelectOption<string>[] => {
    switch (scope) {
      case "question":
        return posted.map((q) => ({ value: q.id, label: `${q.id}　${q.text.slice(0, 22)}${q.text.length > 22 ? "…" : ""}` }))
      case "category":
        return data.categories.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))
      case "platform":
        return PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))
      case "period":
        return [
          { value: "7", label: "直近7日" },
          { value: "30", label: "直近30日" },
          { value: "90", label: "直近90日" },
        ]
      default:
        return []
    }
  }

  const [scope, setScope] = useState<AIInsight["scope"]>("platform")
  const [target, setTarget] = useState<string>("x")
  const [model, setModel] = useState(state.settings.ai.stepModels.analyze)
  const [running, setRunning] = useState(false)

  const targetOptions = optionsFor(scope)

  const resolved = useMemo(() => {
    const opt = targetOptions.find((o) => o.value === target)
    switch (scope) {
      case "question":
        return { ids: posted.filter((q) => q.id === target).map((q) => q.id), label: target }
      case "category":
        return { ids: posted.filter((q) => q.categoryId === target).map((q) => q.id), label: `分類：${opt?.label ?? ""}` }
      case "platform":
        return { ids: posted.filter((q) => q.platform === target).map((q) => q.id), label: `${opt?.label ?? ""}・出題済み` }
      case "period": {
        const from = addDays(DEMO_TODAY, -Number(target))
        return {
          ids: posted.filter((q) => q.plannedDate && q.plannedDate >= from && q.plannedDate <= DEMO_TODAY).map((q) => q.id),
          label: opt?.label ?? "",
        }
      }
      case "certification":
        return { ids: data.questions.filter((q) => q.certification === "candidate" || q.certification === "adopted").map((q) => q.id), label: "検定候補・採用問題" }
      default:
        return { ids: posted.map((q) => q.id), label: "出題済みの全問題" }
    }
  }, [scope, target, targetOptions, posted, data.questions])

  const allowed = can("analyze")
  const cost = AI_MODELS.find((m) => m.id === model)?.costPerQuestion ?? 2

  const run = async () => {
    setRunning(true)
    const id = await actions.runInsight(scope, resolved.label, resolved.ids, model)
    setRunning(false)
    if (id) onStarted(id)
  }

  return (
    <section aria-labelledby="insight-form-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 id="insight-form-title" className="text-sm font-semibold">
          分析を実行
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">必要なときだけ実行します。結果は出題ルールへ自動反映されません。</p>
      </div>

      {!allowed && <PermissionNote role={state.role} need="AI分析を実行" />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="insight-scope">分析対象</Label>
        <SimpleSelect
          id="insight-scope"
          value={scope}
          onChange={(v) => {
            setScope(v)
            setTarget(optionsFor(v)[0]?.value ?? "")
          }}
          options={(Object.keys(SCOPE_LABEL) as AIInsight["scope"][]).map((k) => ({ value: k, label: SCOPE_LABEL[k] }))}
        />
      </div>

      {targetOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="insight-target">対象の指定</Label>
          <SimpleSelect id="insight-target" value={target} onChange={setTarget} options={targetOptions} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="insight-model">モデル</Label>
        <SimpleSelect id="insight-model" value={model} onChange={setModel} options={AI_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-secondary/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">分析内容</p>
        <ul className="flex flex-wrap gap-1.5">
          {ANALYSIS_ITEMS.map((item) => (
            <li key={item} className="rounded border border-border bg-background px-2 py-0.5 text-xs">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          対象 <span className="font-mono text-foreground">{resolved.ids.length}</span> 問
        </span>
        <span>
          概算 <span className="font-mono text-foreground">¥{Math.round(cost * 2 * 10) / 10}</span>
        </span>
      </div>

      <Button onClick={run} disabled={!allowed || running || resolved.ids.length === 0}>
        {running ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        {running ? "分析中…" : "AIで分析する"}
      </Button>
      {resolved.ids.length === 0 && <p className="text-xs text-warning">対象に該当する出題済みの問題がありません。</p>}
    </section>
  )
}
