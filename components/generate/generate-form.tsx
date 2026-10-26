"use client"

import { useState } from "react"
import { Sparkles, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SimpleSelect } from "@/components/shared/simple-select"
import { PlatformMark } from "@/components/shared/platform-badge"
import { PermissionNote } from "@/components/shared/states"
import { useQuiz, type GenerationRequest } from "@/lib/store/quiz-store"
import { AI_MODELS, DIFFICULTY_LABEL, PLATFORM_LABEL } from "@/lib/constants"
import { addDays, DEMO_TODAY, formatYen } from "@/lib/format"
import type { Difficulty, GenerationJob, GenerationOptions, Platform } from "@/lib/types"
import { cn } from "@/lib/utils"

type Mode = GenerationJob["mode"]
const ALL_PLATFORMS: Platform[] = ["x", "discord", "instagram"]

export interface GenerateInitial {
  mode?: Mode
  platform?: Platform
  date?: string
}

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function GenerateForm({ initial, onStarted, monthCost }: { initial: GenerateInitial; onStarted: (jobId: string) => void; monthCost: number }) {
  const { data, state, actions, can } = useQuiz()
  const ai = state.settings.ai
  const [mode, setMode] = useState<Mode>(initial.mode ?? "daily")
  const [platforms, setPlatforms] = useState<Platform[]>(["x", "discord"])
  const [from, setFrom] = useState(addDays(DEMO_TODAY, 1))
  const [to, setTo] = useState(addDays(DEMO_TODAY, 14))
  const [opts, setOpts] = useState<GenerationOptions>({
    count: 1,
    categoryId: "auto",
    difficulty: "auto",
    theme: "",
    usePlan: true,
    usePastAnalysis: true,
    excludeGenerated: true,
    autoApprove: false,
    model: ai.defaultModel,
    instructions: "",
    platform: initial.platform ?? "x",
    date: initial.date,
  })
  const set = <K extends keyof GenerationOptions>(k: K, v: GenerationOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  const rangeInvalid = mode === "bulk" && (!from || !to || from > to)
  const req: GenerationRequest = {
    mode,
    platforms: mode === "daily" ? ["x", "discord"] : mode === "bulk" ? platforms : [opts.platform ?? "x"],
    range: mode === "bulk" ? { from, to } : null,
    options: mode === "single" ? opts : { ...opts, platform: undefined, date: undefined },
  }
  const preview = rangeInvalid ? null : actions.previewGeneration(req)
  const remaining = ai.monthlyBudgetJpy - monthCost
  const overBudget = !!preview && preview.estimatedCostJpy > remaining
  const blockedByBudget = overBudget && ai.stopOnBudget
  const disabled = !can("generate") || state.settings.emergencyStop || !preview?.total || blockedByBudget || (mode === "bulk" && !platforms.length)

  const categoryOptions = [{ value: "auto", label: "自動（計画・傾向から選択）" }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]

  return (
    <Card>
      <CardHeader>
        <CardTitle>生成条件</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            const id = actions.startGeneration(req)
            if (id) onStarted(id)
          }}
        >
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="daily">日次生成</TabsTrigger>
              <TabsTrigger value="bulk">期間一括</TabsTrigger>
              <TabsTrigger value="single">単発生成</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "daily" && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              毎日 {ai.dailyGenerationTime} に自動実行される処理を今すぐ実行します。翌日から{ai.dailyLookaheadDays}日分の未生成枠（X・Discord）と、Instagramのストック不足分が対象です。
            </p>
          )}

          {mode === "bulk" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gen-from">開始日</Label>
                  <Input id="gen-from" type="date" value={from} min={addDays(DEMO_TODAY, 1)} onChange={(e) => setFrom(e.target.value)} aria-invalid={rangeInvalid} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="gen-to">終了日</Label>
                  <Input id="gen-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-invalid={rangeInvalid} />
                </div>
              </div>
              {rangeInvalid && <p className="text-xs text-destructive">終了日は開始日以降にしてください</p>}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">対象媒体</legend>
                <div className="flex flex-wrap gap-4">
                  {ALL_PLATFORMS.map((p) => (
                    <Label key={p} className="flex items-center gap-2 font-normal">
                      <Checkbox checked={platforms.includes(p)} onCheckedChange={(c) => setPlatforms((prev) => (c ? [...prev, p] : prev.filter((x) => x !== p)))} />
                      <PlatformMark platform={p} />
                      {PLATFORM_LABEL[p]}
                    </Label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {mode === "single" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gen-pf">媒体</Label>
                <SimpleSelect<Platform> id="gen-pf" value={opts.platform ?? "x"} onChange={(v) => set("platform", v)} options={ALL_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gen-date">出題日（任意）</Label>
                <Input id="gen-date" type="date" min={addDays(DEMO_TODAY, 1)} value={opts.date ?? ""} disabled={opts.platform === "instagram"} onChange={(e) => set("date", e.target.value || undefined)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gen-count">生成数</Label>
                <Input id="gen-count" type="number" min={1} max={20} value={opts.count} onChange={(e) => set("count", Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-cat">カテゴリ</Label>
              <SimpleSelect id="gen-cat" value={opts.categoryId} onChange={(v) => set("categoryId", v)} options={categoryOptions} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-diff">難易度</Label>
              <SimpleSelect<Difficulty> id="gen-diff" value={opts.difficulty} onChange={(v) => set("difficulty", v)} options={(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((k) => ({ value: k, label: DIFFICULTY_LABEL[k] }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-theme">テーマ（任意）</Label>
              <Input id="gen-theme" value={opts.theme} placeholder="例：系外惑星" onChange={(e) => set("theme", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-model">AIモデル</Label>
              <SimpleSelect id="gen-model" value={opts.model} onChange={(v) => set("model", v)} options={AI_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="gen-ins">追加指示（任意）</Label>
              <Textarea id="gen-ins" rows={2} value={opts.instructions} placeholder="例：中学生でも解ける表現にする" onChange={(e) => set("instructions", e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <ToggleRow id="gen-plan" label="出題計画の条件を優先" hint="枠ごとに指定したカテゴリ・難易度を使います" checked={opts.usePlan} onChange={(v) => set("usePlan", v)} />
            <ToggleRow id="gen-past" label="過去の回答傾向を反映" hint="正答率・回答数の分析結果をプロンプトに含めます" checked={opts.usePastAnalysis} onChange={(v) => set("usePastAnalysis", v)} />
            <ToggleRow id="gen-excl" label="生成済み問題と重複させない" hint="類似度の高い候補は自動で除外します" checked={opts.excludeGenerated} onChange={(v) => set("excludeGenerated", v)} />
            <ToggleRow id="gen-auto" label="条件を満たせば自動承認" hint="スコア・出典・一意性の基準をすべて満たす候補のみ確定します" checked={opts.autoApprove} onChange={(v) => set("autoApprove", v)} />
          </div>

          <div className={cn("flex flex-col gap-2 rounded-lg border p-4", overBudget ? "border-warning/50 bg-warning/5" : "bg-muted/30")}>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">生成対象</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">{preview?.total ?? "—"}<span className="ml-0.5 text-xs font-normal">件</span></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">推定費用</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">{preview ? formatYen(preview.estimatedCostJpy) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">今月の残り予算</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">{formatYen(remaining)}</dd>
              </div>
            </dl>
            {preview && preview.total > 0 && (
              <p className="text-xs text-muted-foreground">
                出題枠 {preview.slotCount}件{preview.extra > 0 && ` ＋ ストック ${preview.extra}件`}。確定済み・予約済みの枠は上書きしません。
              </p>
            )}
            {preview && preview.total === 0 && <p className="text-xs text-muted-foreground">対象期間の出題枠はすべて生成済み・確定済みです</p>}
            {overBudget && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <TriangleAlert className="size-3.5" aria-hidden />
                残り予算を超えます{ai.stopOnBudget ? "（設定により実行できません）" : ""}
              </p>
            )}
          </div>

          {!can("generate") && <PermissionNote role={state.role} need="AI生成を実行" />}
          {state.settings.emergencyStop && <p className="text-sm text-destructive">緊急停止中のため生成できません</p>}

          <Button type="submit" size="lg" disabled={disabled}>
            <Sparkles className="size-4" aria-hidden />
            生成を開始
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
