"use client"

// 実APIモード：Gemini で問題を作り、検査を通ったものを下書きで正本に保存する（GAS の generateQuestions）。
// 自動で承認・投稿はしない。保存した問題は「確認・承認」で人が確かめる。
import { useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SimpleSelect } from "@/components/shared/simple-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { useQuiz } from "@/lib/store/quiz-store"
import { questionHref } from "@/lib/routes"
import type { GenerateQuestionsInput, GenerateQuestionsResult } from "@/lib/services/gas-contract"
import { cn } from "@/lib/utils"

const COUNT_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} 問` }))
const DIFFICULTY_OPTIONS: { value: NonNullable<GenerateQuestionsInput["difficulty"]>; label: string }[] = [
  { value: "auto", label: "おまかせ（初級〜中級）" },
  { value: "beginner", label: "初級" },
  { value: "intermediate", label: "中級" },
  { value: "advanced", label: "上級" },
]

export function LiveGenerate() {
  const { state, actions, can } = useQuiz()
  const ai = state.liveStatus.ai
  const [platform, setPlatform] = useState<GenerateQuestionsInput["platform"]>("x")
  const [count, setCount] = useState("3")
  const [difficulty, setDifficulty] = useState<NonNullable<GenerateQuestionsInput["difficulty"]>>("auto")
  const [theme, setTheme] = useState("")
  const [instructions, setInstructions] = useState("")
  const [plannedDate, setPlannedDate] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<GenerateQuestionsResult | null>(null)

  const overBudget = !!ai && ai.monthCostJpy >= ai.budgetJpy
  const disabled = running || !ai?.configured || overBudget || !can("generate") || state.settings.emergencyStop

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRunning(true)
    try {
      const res = await actions.liveGenerate({
        platform,
        count: Number(count),
        difficulty,
        theme: theme.trim() || undefined,
        instructions: instructions.trim() || undefined,
        plannedDate: plannedDate || undefined,
      })
      if (res) setResult(res)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" aria-hidden />
            Gemini で問題を作る
          </CardTitle>
          <CardDescription>作った問題は下書きで正本に保存します。URL・文字数などの検査を通らないものは保存しません。承認は「確認・承認」で行ってください。</CardDescription>
        </CardHeader>
        <CardContent>
          {!ai ? (
            <p className="text-sm text-muted-foreground">AI の状態を取得できていません。GAS を最新のコードで「新しいバージョン」としてデプロイし、「正本から再読み込み」を押してください。</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              {!ai.configured && (
                <p role="note" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                  Gemini が未設定です。GAS のスクリプトプロパティ GEMINI_API_KEY を登録してください。
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lg-platform">媒体</Label>
                  <SimpleSelect
                    id="lg-platform"
                    value={platform}
                    onChange={setPlatform}
                    options={[
                      { value: "x", label: "X" },
                      { value: "discord", label: "Discord" },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lg-count">作る数</Label>
                  <SimpleSelect id="lg-count" value={count} onChange={setCount} options={COUNT_OPTIONS} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lg-difficulty">難易度</Label>
                  <SimpleSelect id="lg-difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lg-date">出題日（任意）</Label>
                  <Input id="lg-date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lg-theme">テーマ（任意）</Label>
                <Input id="lg-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="例：木星の衛星、はやぶさ2" maxLength={100} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lg-instructions">追加の指示（任意）</Label>
                <Textarea id="lg-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} maxLength={500} placeholder="例：数字を問う問題は避ける" />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs">
                <dt className="text-muted-foreground">生成のモデル</dt>
                <dd className="font-mono">{ai.model}</dd>
                <dt className="text-muted-foreground">今月の使用量（有料枠換算）</dt>
                <dd className={cn("tabular-nums", overBudget && "text-destructive")}>
                  約 {Math.round(ai.monthCostJpy)} 円 / 上限 {ai.budgetJpy} 円
                </dd>
              </dl>
              {overBudget && <p className="text-xs text-destructive">今月の上限に達したため実行できません（GAS の AI_MONTHLY_BUDGET_JPY で変えられます）。</p>}
              <Button type="submit" disabled={disabled}>
                <Sparkles className={running ? "animate-pulse" : undefined} />
                {running ? "生成中…（数十秒かかります）" : "生成して下書きに保存"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">結果</CardTitle>
          <CardDescription>保存した問題は問題ライブラリにも並びます。ファクトチェックは問題の画面の「再検証」から実行できます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">まだ実行していません</p>
          ) : (
            <>
              <section className="flex flex-col gap-2" aria-label="保存した問題">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  下書きで保存 <StatusBadge tone="success" label={`${result.saved.length} 問`} />
                </h3>
                {result.saved.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ありません</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {result.saved.map((q) => (
                      <li key={q.id} className="flex items-start gap-2 text-sm">
                        <Link href={questionHref(q.id)} className="shrink-0 font-mono text-primary hover:underline">
                          {q.id}
                        </Link>
                        <span>{q.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {result.rejected.length > 0 && (
                <section className="flex flex-col gap-2" aria-label="検査で除外した問題">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    検査で除外 <StatusBadge tone="warning" label={`${result.rejected.length} 問`} />
                  </h3>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {result.rejected.map((r, i) => (
                      <li key={i} className="flex flex-col">
                        <span>{r.text || "（問題文なし）"}</span>
                        <span className="text-xs text-muted-foreground">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="text-xs text-muted-foreground">
                モデル <span className="font-mono">{result.model}</span> ・ 今回の概算 約 {result.estCostJpy} 円（有料枠換算）
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
