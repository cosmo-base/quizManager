"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { Platform } from "@/lib/types"
import { useQuiz } from "@/lib/store/quiz-store"
import { DIFFICULTY_LABEL, PLATFORM_LABEL } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Field, NumberField, SettingsCard, SwitchRow } from "@/components/settings/fields"

const SOURCE_PRIORITY = ["公的機関（JAXA・NASA・ESA等）の一次情報", "学術論文・研究機関の発表", "主要報道機関の記事", "百科事典・専門書"]

export function RulesSettingsTab({ disabled }: { disabled: boolean }) {
  const { state, data, actions } = useQuiz()
  const r = state.settings.rules
  const set = actions.updateSettings
  const [newCategory, setNewCategory] = useState("")

  const addCategory = () => {
    const name = newCategory.trim()
    if (!name) return
    actions.addCategory(name)
    setNewCategory("")
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <SettingsCard title="媒体別の生成方針">
        {(Object.keys(r.platformPolicies) as Platform[]).map((p) => (
          <Field key={p} id={`policy-${p}`} label={PLATFORM_LABEL[p]}>
            <Textarea id={`policy-${p}`} rows={2} value={r.platformPolicies[p]} disabled={disabled} onChange={(e) => set((d) => void (d.rules.platformPolicies[p] = e.target.value))} />
          </Field>
        ))}
      </SettingsCard>

      <SettingsCard title="難易度の定義">
        {(Object.keys(r.difficultyDefinitions) as (keyof typeof r.difficultyDefinitions)[]).map((k) => (
          <Field key={k} id={`diff-${k}`} label={DIFFICULTY_LABEL[k]}>
            <Textarea id={`diff-${k}`} rows={2} value={r.difficultyDefinitions[k]} disabled={disabled} onChange={(e) => set((d) => void (d.rules.difficultyDefinitions[k] = e.target.value))} />
          </Field>
        ))}
      </SettingsCard>

      <SettingsCard title="分類" description="無効にした分類は新規生成の対象外になります。">
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {data.categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className={c.active ? "text-sm" : "text-sm text-muted-foreground line-through"}>{c.name}</span>
              <Switch aria-label={`${c.name}を有効にする`} checked={c.active} disabled={disabled} onCheckedChange={() => actions.toggleCategory(c.id)} />
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addCategory()
          }}
        >
          <Input aria-label="追加する分類名" placeholder="新しい分類名" value={newCategory} disabled={disabled} onChange={(e) => setNewCategory(e.target.value)} />
          <Button type="submit" variant="outline" disabled={disabled || !newCategory.trim()}>
            <Plus aria-hidden />
            追加
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard title="良問評価項目" description="AI検証時に採点する項目です。">
        <ul className="flex flex-col gap-3">
          {r.qualityItems.map((q, idx) => (
            <li key={q.key}>
              <SwitchRow id={`quality-${q.key}`} label={q.label} checked={q.enabled} disabled={disabled} onChange={(v) => set((d) => void (d.rules.qualityItems[idx].enabled = v))} />
            </li>
          ))}
        </ul>
      </SettingsCard>

      <SettingsCard title="重複制限・再検証">
        <div className="flex flex-wrap gap-4">
          <NumberField id="same-months" label="同一媒体での再出題禁止" suffix="か月" min={0} value={r.sameplatformMonths} disabled={disabled} onChange={(v) => set((d) => void (d.rules.sameplatformMonths = v))} />
          <NumberField id="cross-months" label="他媒体での再出題禁止" suffix="か月" min={0} value={r.crossPlatformMonths} disabled={disabled} onChange={(v) => set((d) => void (d.rules.crossPlatformMonths = v))} />
          <NumberField id="recheck-days" label="時事問題の再検証" suffix="日ごと" min={1} value={r.recheckDaysForCurrent} disabled={disabled} onChange={(v) => set((d) => void (d.rules.recheckDaysForCurrent = v))} />
        </div>
        <SwitchRow id="balance-position" label="正解位置の偏り抑制" hint="直近の出題でA/B/Cが均等になるよう生成時に調整します" checked={r.balanceAnswerPosition} disabled={disabled} onChange={(v) => set((d) => void (d.rules.balanceAnswerPosition = v))} />
      </SettingsCard>

      <SettingsCard title="出典の優先順位">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed">
          {SOURCE_PRIORITY.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </SettingsCard>

      <div className="xl:col-span-2">
        <SettingsCard title="AI分析から反映したルール" description="AI定性分析で運営者が承認した改善案です。生成時のプロンプトに追加されます。">
          {r.approvedInsightRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">反映済みのルールはありません。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {r.approvedInsightRules.map((rule, idx) => (
                <li key={rule} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <span className="text-sm leading-relaxed text-pretty">{rule}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="このルールを削除"
                    disabled={disabled}
                    onClick={() => set((d) => void d.rules.approvedInsightRules.splice(idx, 1), "ルールを削除しました")}
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      </div>
    </div>
  )
}
