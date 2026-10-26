"use client"

import { Copy } from "lucide-react"
import { useQuiz } from "@/lib/store/quiz-store"
import { AI_MODELS, PLATFORM_LABEL } from "@/lib/constants"
import { formatYen } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SimpleSelect } from "@/components/shared/simple-select"
import { SimpleBarChart } from "@/components/kpi/kpi-charts"
import { Field, IntegrationList, NumberField, SettingsCard, SwitchRow, TimeField } from "@/components/settings/fields"

const MODEL_OPTIONS = AI_MODELS.map((m) => ({ value: m.id, label: m.label }))

export function AiSettingsTab({ disabled }: { disabled: boolean }) {
  const { state, data, actions } = useQuiz()
  const s = state.settings
  const set = actions.updateSettings
  const thisMonth = data.usage.at(-1)
  const monthTotal = thisMonth ? thisMonth.aiJpy + thisMonth.snsJpy + thisMonth.dbJpy : 0
  const ratio = s.ai.monthlyBudgetJpy ? Math.min(100, Math.round((monthTotal / s.ai.monthlyBudgetJpy) * 100)) : 0

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <SettingsCard title="API接続" description="推奨初期構成はGemini APIです。モデルは処理ごとに切り替えられます。">
        <IntegrationList keys={["gemini"]} />
      </SettingsCard>

      <SettingsCard title="利用モデル">
        <Field id="model-default" label="既定モデル">
          <SimpleSelect id="model-default" disabled={disabled} value={s.ai.defaultModel} options={MODEL_OPTIONS} onChange={(v) => set((d) => void (d.ai.defaultModel = v))} />
        </Field>
        {(
          [
            ["generate", "問題生成"],
            ["verify", "検証・ファクトチェック"],
            ["analyze", "定性分析"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} id={`model-${key}`} label={`${label}に使うモデル`}>
            <SimpleSelect id={`model-${key}`} disabled={disabled} value={s.ai.stepModels[key]} options={MODEL_OPTIONS} onChange={(v) => set((d) => void (d.ai.stepModels[key] = v))} />
          </Field>
        ))}
      </SettingsCard>

      <SettingsCard title="生成・検証" description="自動承認は検証モードを解除し、全検証項目がOKの問題に限り有効になります。">
        <SwitchRow id="verification-mode" label="検証モード（全件人間確認）" hint="運用初期は有効を推奨。自動承認と一括承認が無効になります" checked={s.verificationMode} disabled={disabled} onChange={(v) => set((d) => void (d.verificationMode = v), v ? "検証モードを有効にしました" : "検証モードを解除しました")} />
        <SwitchRow id="search-enabled" label="Web検索による出典確認" checked={s.ai.searchEnabled} disabled={disabled} onChange={(v) => set((d) => void (d.ai.searchEnabled = v))} />
        <SwitchRow id="daily-gen" label="毎日の自動生成" checked={s.ai.dailyGenerationEnabled} disabled={disabled} onChange={(v) => set((d) => void (d.ai.dailyGenerationEnabled = v))} />
        <div className="flex flex-wrap gap-4">
          <TimeField id="daily-gen-time" label="自動生成の実行時刻" value={s.ai.dailyGenerationTime} disabled={disabled} onChange={(v) => set((d) => void (d.ai.dailyGenerationTime = v))} />
          <NumberField id="lookahead" label="何日先まで生成するか" suffix="日" min={1} max={30} value={s.ai.dailyLookaheadDays} disabled={disabled} onChange={(v) => set((d) => void (d.ai.dailyLookaheadDays = v))} />
          <NumberField id="max-regen" label="再生成回数の上限" suffix="回" min={0} max={10} value={s.ai.maxRegenerations} disabled={disabled} onChange={(v) => set((d) => void (d.ai.maxRegenerations = v))} />
        </div>
      </SettingsCard>

      <SettingsCard title="費用上限・利用量" description="上限に達した場合の動作を選べます。表示額はサンプルです。">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>今月の利用額</span>
            <span className="font-mono">
              {formatYen(monthTotal)} / {formatYen(s.ai.monthlyBudgetJpy)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={ratio} aria-valuemin={0} aria-valuemax={100} aria-label="月額上限に対する利用率">
            <div className={ratio >= s.ai.budgetWarnRatio * 100 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${ratio}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <NumberField id="budget" label="月額費用上限" suffix="円" min={0} value={s.ai.monthlyBudgetJpy} disabled={disabled} onChange={(v) => set((d) => void (d.ai.monthlyBudgetJpy = v))} />
          <NumberField id="budget-warn" label="警告を出す割合" suffix="%" min={10} max={100} value={Math.round(s.ai.budgetWarnRatio * 100)} disabled={disabled} onChange={(v) => set((d) => void (d.ai.budgetWarnRatio = v / 100))} />
        </div>
        <SwitchRow id="stop-budget" label="上限到達時にAI処理を停止" checked={s.ai.stopOnBudget} disabled={disabled} onChange={(v) => set((d) => void (d.ai.stopOnBudget = v))} />
        <SimpleBarChart label="月額（円）" data={data.usage.map((u) => ({ name: `${Number(u.month.slice(5))}月`, value: u.aiJpy + u.snsJpy + u.dbJpy }))} />
      </SettingsCard>
    </div>
  )
}

export function PostingSettingsTab({ disabled }: { disabled: boolean }) {
  const { state, data, actions } = useQuiz()
  const p = state.settings.posting
  const set = actions.updateSettings

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <SettingsCard title="媒体の接続" description="X APIは技術検証中です。自動投稿できない場合は手動対応へ切り替えます。">
        <IntegrationList keys={["x", "discord", "instagram"]} />
      </SettingsCard>

      <SettingsCard title="出題スケジュール" description="すべて日本時間です。">
        <div className="grid grid-cols-2 gap-4">
          <TimeField id="post-time" label="出題時刻" value={p.defaultTime} disabled={disabled} onChange={(v) => set((d) => void (d.posting.defaultTime = v))} />
          <TimeField id="precheck-time" label="投稿前チェック" value={p.precheckTime} disabled={disabled} onChange={(v) => set((d) => void (d.posting.precheckTime = v))} />
          <TimeField id="close-time" label="回答締切" value={p.closeTime} disabled={disabled} onChange={(v) => set((d) => void (d.posting.closeTime = v))} />
          <TimeField id="answer-time" label="解説公開" value={p.answerTime} disabled={disabled} onChange={(v) => set((d) => void (d.posting.answerTime = v))} />
        </div>
        <Field id="notify-to" label="投稿失敗時の通知先" hint="メールアドレスまたはDiscordチャンネル">
          <Input id="notify-to" value={p.failureNotifyTo} disabled={disabled} onChange={(e) => set((d) => void (d.posting.failureNotifyTo = e.target.value))} />
        </Field>
      </SettingsCard>

      <SettingsCard title="Instagram運用" description="投稿は休止中です。出題可能な問題をストックとして蓄積します。">
        <SwitchRow id="ig-active" label="Instagramへの投稿を再開" checked={p.instagramActive} disabled={disabled} onChange={(v) => set((d) => void (d.posting.instagramActive = v))} />
        <NumberField id="ig-stock" label="最低ストック数" hint="下回ると通知します" suffix="問" min={0} value={p.instagramMinStock} disabled={disabled} onChange={(v) => set((d) => void (d.posting.instagramMinStock = v))} />
      </SettingsCard>

      <SettingsCard title="投稿画像テンプレート">
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {data.imageTemplates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {PLATFORM_LABEL[t.platform]}・{t.aspect}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon-sm" variant="ghost" aria-label={`${t.name}を複製`} disabled={disabled} onClick={() => actions.duplicateImageTemplate(t.id)}>
                  <Copy aria-hidden />
                </Button>
                <Switch aria-label={`${t.name}を有効にする`} checked={t.active} disabled={disabled} onCheckedChange={(v) => actions.updateImageTemplate(t.id, { active: Boolean(v) })} />
              </div>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  )
}
