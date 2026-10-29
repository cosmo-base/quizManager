"use client"

// 実APIモード：問題を正本（Sheets）に保存する。新規は GAS が ID を採番し、既存は新しい版を追記する。
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SimpleSelect } from "@/components/shared/simple-select"
import { useQuiz } from "@/lib/store/quiz-store"
import type { ChoiceLabel, Difficulty, Platform, Question, QuestionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DISCORD_EMOJI } from "@/lib/discord-format"
import { DIFFICULTY_LABEL } from "@/lib/constants"
import { X_POLL_OPTION_MAX, xPollOption } from "@/lib/x-poll"
import { CARD_SUMMARY_MAX, LEAD_MAX, questionError, TOPIC_MAX } from "@/lib/question-validate"
import { SimilarWarning } from "@/components/questions/live-suggestion"

const LABELS: ChoiceLabel[] = ["A", "B", "C"]

const STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "review", label: "確認待ち" },
  { value: "approved", label: "承認済み（出題日があれば予約、空欄なら予備）" },
]

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "auto", label: "未設定" },
  ...(["beginner", "intermediate", "advanced"] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] })),
]

export function LiveQuestionDialog({ q, open, onOpenChange }: { q?: Question; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, actions, can } = useQuiz()
  // GAS は「承認済み」で保存するには承認、下書き・確認待ちで保存するには編集の権限を求める
  const statusOptions = STATUS_OPTIONS.filter((o) => (o.value === "approved" ? can("approve") : can("edit")))
  const [platform, setPlatform] = useState<Exclude<Platform, "instagram">>(q?.platform === "discord" ? "discord" : "x")
  const [plannedDate, setPlannedDate] = useState(q?.plannedDate ?? "")
  const [status, setStatus] = useState<QuestionStatus>(
    q && statusOptions.some((o) => o.value === q.status) ? q.status : (statusOptions.find((o) => o.value === "review") ?? statusOptions[0])?.value ?? "draft",
  )
  const [text, setText] = useState(q?.text ?? "")
  const [choices, setChoices] = useState<string[]>(LABELS.map((l) => q?.choices.find((c) => c.label === l)?.text ?? ""))
  const [answer, setAnswer] = useState<ChoiceLabel>(q?.answer ?? "A")
  const [explanation, setExplanation] = useState(q?.explanation ?? "")
  const [note, setNote] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>(q?.difficulty ?? "auto")
  const [category, setCategory] = useState(q?.categoryId || "none")
  const [topic, setTopic] = useState(q?.topic ?? "")
  const [lead, setLead] = useState(q?.lead ?? "")
  const [cardSummary, setCardSummary] = useState(q?.cardSummary ?? "")
  const categoryOptions = [{ value: "none", label: "未設定" }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const optionLength = (i: number) => xPollOption(LABELS[i], choices[i]).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalid = questionError({ text, choices, answer, explanation, lead, cardSummary }, platform)
    if (invalid) return setError(invalid)
    setSaving(true)
    const saved = await actions.saveLiveQuestion({
      id: q?.id,
      text: text.trim(),
      choices: LABELS.map((label, i) => ({ label, text: choices[i].trim() })),
      answer,
      explanation: explanation.trim(),
      platform,
      plannedDate: plannedDate || null,
      status,
      note: note.trim() || undefined,
      difficulty: difficulty === "auto" ? null : difficulty,
      category: category === "none" ? null : category,
      topic: topic.trim() || null,
      lead: lead.trim(),
      cardSummary: cardSummary.trim(),
    })
    setSaving(false)
    if (saved) {
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{q ? `問題を編集（${q.id}）` : "問題を作成"}</DialogTitle>
            <DialogDescription>正本（Google Sheets）に保存します。{q ? "保存すると新しい版が追加されます。" : "ID は自動で採番されます。"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-platform">媒体</Label>
              <SimpleSelect
                id="lq-platform"
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: "x", label: "X" },
                  { value: "discord", label: "Discord" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-date">出題日</Label>
              <Input id="lq-date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-status">状態</Label>
              <SimpleSelect id="lq-status" value={status} onChange={setStatus} options={statusOptions} />
              {status === "approved" && (!q || q.status !== "approved") && (
                <span className="text-xs text-muted-foreground">承認済みにするには、この内容でのファクトチェック（要確認以上）が要ります</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-difficulty">難易度</Label>
              <SimpleSelect id="lq-difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-category">分類</Label>
              <SimpleSelect id="lq-category" value={category} onChange={setCategory} options={categoryOptions} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-topic">題材</Label>
              <Input id="lq-topic" value={topic} maxLength={TOPIC_MAX} onChange={(e) => setTopic(e.target.value)} placeholder="例：木星" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lq-lead">
              前振り（任意）<span className="ml-2 text-xs font-normal text-muted-foreground">問題文の前に入る背景。答えは書かない（{lead.length}/{LEAD_MAX}）</span>
            </Label>
            <Textarea id="lq-lead" value={lead} maxLength={LEAD_MAX} onChange={(e) => setLead(e.target.value)} rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lq-text">問題文</Label>
            <Textarea id="lq-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            <SimilarWarning text={text} answerText={choices[LABELS.indexOf(answer)]} exclude={q?.id} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              選択肢と正解
              {platform === "x" && <span className="ml-2 text-xs font-normal text-muted-foreground">X の投票には「①〜」の形で入ります（番号込み {X_POLL_OPTION_MAX} 文字まで）</span>}
              {platform === "discord" && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Discord では {LABELS.map((l) => DISCORD_EMOJI[l]).join("")} のリアクションで回答します（複数選んだ回答は無効）
                </span>
              )}
            </legend>
            {LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnswer(label)}
                  aria-pressed={answer === label}
                  aria-label={`${label}を正解にする`}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold",
                    answer === label ? "border-success bg-success text-success-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
                <Input aria-label={`選択肢${label}`} value={choices[i]} onChange={(e) => setChoices((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))} />
                {platform === "x" && (
                  <span className={cn("w-12 shrink-0 text-right font-mono text-xs tabular-nums", optionLength(i) > X_POLL_OPTION_MAX ? "text-destructive" : "text-muted-foreground")}>
                    {optionLength(i)}/{X_POLL_OPTION_MAX}
                  </span>
                )}
              </div>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lq-exp">解説（翌朝の{platform === "discord" ? "正解発表" : "引用リポスト"}）</Label>
            <Textarea id="lq-exp" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={5} />
          </div>
          {platform === "discord" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-card">
                画像用の短い解説（任意）
                <span className="ml-2 text-xs font-normal text-muted-foreground">正解カードに載せる文。空欄なら解説の冒頭を使います（{cardSummary.length}/{CARD_SUMMARY_MAX}）</span>
              </Label>
              <Textarea id="lq-card" value={cardSummary} maxLength={CARD_SUMMARY_MAX} onChange={(e) => setCardSummary(e.target.value)} rows={2} />
            </div>
          )}
          {q && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lq-note">変更理由（任意）</Label>
              <Input id="lq-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：選択肢Bの表記を修正" />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中…" : "正本に保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
