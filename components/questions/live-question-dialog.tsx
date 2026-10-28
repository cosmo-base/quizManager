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
import type { ChoiceLabel, Platform, Question, QuestionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DISCORD_EMOJI, DISCORD_MESSAGE_MAX, overlongDiscordText } from "@/lib/discord-format"
import { X_POLL_OPTION_MAX, xPollOption } from "@/lib/x-poll"

const LABELS: ChoiceLabel[] = ["A", "B", "C"]
const URL_PATTERN = /(https?:\/\/|www\.)|\b[a-z0-9][a-z0-9-]*\.(com|net|org|jp|io|co|me|ly|gl|ai|dev|app|info|biz|tv|link)\b/i

const STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = [
  { value: "draft", label: "下書き" },
  { value: "review", label: "確認待ち" },
  { value: "approved", label: "承認済み（出題日があれば予約、空欄なら予備）" },
]

export function LiveQuestionDialog({ q, open, onOpenChange }: { q?: Question; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { actions } = useQuiz()
  const [platform, setPlatform] = useState<Exclude<Platform, "instagram">>(q?.platform === "discord" ? "discord" : "x")
  const [plannedDate, setPlannedDate] = useState(q?.plannedDate ?? "")
  const [status, setStatus] = useState<QuestionStatus>(q && STATUS_OPTIONS.some((o) => o.value === q.status) ? q.status : "draft")
  const [text, setText] = useState(q?.text ?? "")
  const [choices, setChoices] = useState<string[]>(LABELS.map((l) => q?.choices.find((c) => c.label === l)?.text ?? ""))
  const [answer, setAnswer] = useState<ChoiceLabel>(q?.answer ?? "A")
  const [explanation, setExplanation] = useState(q?.explanation ?? "")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const optionLength = (i: number) => xPollOption(LABELS[i], choices[i]).length
  const tooLong = platform === "x" ? LABELS.filter((_, i) => optionLength(i) > X_POLL_OPTION_MAX) : []
  const discordLength =
    platform === "discord" ? overlongDiscordText({ text, choices: LABELS.map((label, i) => ({ label, text: choices[i] })), answer, explanation }) : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || choices.some((c) => !c.trim()) || !explanation.trim()) return setError("問題文・選択肢・解説は必須です")
    if (new Set(choices.map((c) => c.trim())).size !== choices.length) return setError("選択肢が重複しています")
    if (tooLong.length) return setError(`選択肢 ${tooLong.join("・")} が長すぎます（X の投票は番号込みで ${X_POLL_OPTION_MAX} 文字まで）`)
    if (discordLength !== null) return setError(`Discord のメッセージが ${discordLength} 文字あります（${DISCORD_MESSAGE_MAX} 文字まで）`)
    if ([text, explanation, ...choices].some((v) => URL_PATTERN.test(v))) return setError("投稿本文には URL を入れられません")
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
              <SimpleSelect id="lq-status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lq-text">問題文</Label>
            <Textarea id="lq-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              選択肢と正解
              {platform === "x" && <span className="ml-2 text-xs font-normal text-muted-foreground">X の投票には「1. 〜」の形で入ります（番号込み {X_POLL_OPTION_MAX} 文字まで）</span>}
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
            <Label htmlFor="lq-exp">解説（翌朝の{platform === "discord" ? "返信" : "リプライ"}）</Label>
            <Textarea id="lq-exp" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
          </div>
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
