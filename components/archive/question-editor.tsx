"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type {
  ArchiveChoiceId,
  ArchiveFieldId,
  ArchiveFixedDifficulty,
  ArchiveQuestionDetail,
  ArchiveQuestionStatus,
  ArchiveQuestionSummary,
  ArchiveReference,
  ArchiveSaveNoticeInput,
  ArchiveVersion,
} from "@/lib/services/gas-contract"
import {
  ARCHIVE_CHOICES,
  ARCHIVE_DIFFICULTY_LABEL,
  ARCHIVE_FIELD_LABEL,
  ARCHIVE_FIELDS,
  ARCHIVE_REPORT_REASON_LABEL,
  ARCHIVE_REPORT_STATUS_LABEL,
  errorMessage,
  formatAccuracy,
  formatJst,
} from "@/lib/archive"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SimpleSelect } from "@/components/shared/simple-select"

interface Form {
  text: string
  choices: Record<ArchiveChoiceId, string>
  correct: ArchiveChoiceId
  explanation: string
  references: ArchiveReference[]
  fieldId: ArchiveFieldId
  status: ArchiveQuestionStatus
  /** "auto" は自動（固定しない） */
  difficulty: ArchiveFixedDifficulty | "auto"
  changeReason: string
  resetStats: boolean
}

const FIXED_DIFFICULTIES: ArchiveFixedDifficulty[] = ["beginner", "intermediate", "advanced", "expert"]

function formOf(d: ArchiveQuestionDetail): Form {
  const v: ArchiveVersion | undefined = d.versions.find((x) => x.versionId === d.question.currentVersionId) ?? d.versions[0]
  return {
    text: v?.text ?? "",
    choices: { A: v?.choices.A ?? "", B: v?.choices.B ?? "", C: v?.choices.C ?? "" },
    correct: (["A", "B", "C"].includes(v?.correct ?? "") ? v!.correct : "A") as ArchiveChoiceId,
    explanation: v?.explanation ?? "",
    references: v?.references ?? [],
    fieldId: d.question.fieldId,
    status: d.question.status,
    difficulty: d.question.difficultyOverride || "auto",
    changeReason: "",
    resetStats: false,
  }
}

const sameRefs = (a: ArchiveReference[], b: ArchiveReference[]) =>
  JSON.stringify(a.filter((r) => r.title || r.url)) === JSON.stringify(b.filter((r) => r.title || r.url))

export function ArchiveQuestionEditor({
  questionId,
  canEdit,
  onClose,
  onSaved,
  onDraftNotice,
}: {
  questionId: string | null
  canEdit: boolean
  onClose: () => void
  onSaved: (summary: Partial<ArchiveQuestionSummary> & { id: string }) => void
  onDraftNotice: (draft: ArchiveSaveNoticeInput) => void
}) {
  const { state } = useQuiz()
  const backend = getBackend(state.settings.dataMode)
  const [detail, setDetail] = useState<ArchiveQuestionDetail | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  // 正解を変えて保存したとき：訂正のお知らせの下書きに使う
  const [answerFix, setAnswerFix] = useState<{ before: string; after: string } | null>(null)
  // 開いたときは見出し（問題ID）に移る。下の「閉じる」に移ると、画面が下までスクロールして始まるため
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setDetail(null)
    setForm(null)
    setError("")
    setAnswerFix(null)
    if (!questionId) return
    let cancelled = false
    backend
      .archiveGetQuestion(questionId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setForm(formOf(d))
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [questionId, backend])

  const current = detail ? (detail.versions.find((v) => v.versionId === detail.question.currentVersionId) ?? null) : null
  const changes = useMemo(() => {
    if (!form || !detail) return { content: false, answer: false, meta: false }
    const c = current
    const answer = !c || c.correct !== form.correct || ARCHIVE_CHOICES.some((k) => (c.choices[k] ?? "") !== form.choices[k].trim())
    const content = answer || !c || c.text !== form.text.trim() || c.explanation !== form.explanation.trim() || !sameRefs(c.references, form.references)
    const meta =
      detail.question.fieldId !== form.fieldId || detail.question.status !== form.status || (detail.question.difficultyOverride || "auto") !== form.difficulty
    return { content, answer, meta }
  }, [form, detail, current])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const choiceText = (f: { choices: Record<ArchiveChoiceId, string> }, k: string) => `${k}. ${f.choices[k as ArchiveChoiceId] ?? ""}`

  const save = () => {
    if (!form || !detail || saving) return
    setSaving(true)
    setError("")
    const before = current ? choiceText(current, current.correct) : ""
    backend
      .archiveSaveQuestion({
        questionId: detail.question.id,
        baseVersionId: detail.question.currentVersionId,
        text: form.text,
        choices: form.choices,
        correct: form.correct,
        explanation: form.explanation,
        references: form.references.filter((r) => r.title || r.url),
        fieldId: form.fieldId,
        status: form.status,
        difficultyOverride: form.difficulty === "auto" ? "" : form.difficulty,
        changeReason: form.changeReason,
        resetStats: form.resetStats,
      })
      .then((d) => {
        setDetail(d)
        setForm(formOf(d))
        const cur = d.versions[0]
        onSaved({
          id: d.question.id,
          status: d.question.status,
          fieldId: d.question.fieldId,
          text: cur?.text ?? "",
          versionId: d.question.currentVersionId,
          versionNo: cur?.versionNo ?? 0,
          difficulty: d.question.difficulty,
          autoDifficulty: d.question.autoDifficulty,
          difficultyOverride: d.question.difficultyOverride,
          displayAccuracy: d.question.displayAccuracy,
        })
        if (!d.saved?.changed) {
          toast.info("変更はありませんでした")
          return
        }
        toast.success(d.saved.newVersionId ? `保存しました（新しい版 ${d.saved.newVersionId}）` : "保存しました", { description: "過去問サイトにすぐ反映されます" })
        if (current && cur && current.correct !== cur.correct) setAnswerFix({ before, after: choiceText(cur, cur.correct) })
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setSaving(false))
  }

  const disabled = !canEdit || saving
  const reasonMissing = changes.content && !form?.changeReason.trim()

  return (
    <Dialog open={questionId !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" initialFocus={titleRef}>
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="font-mono outline-none">
            {questionId}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `出題日 ${detail.question.postedOn}・サイト公開 ${detail.question.publishFrom}・正答率 ${formatAccuracy(detail.question.displayAccuracy)}（${ARCHIVE_DIFFICULTY_LABEL[detail.question.difficulty]}${detail.question.difficultyOverride ? "・固定" : ""}、サイトの基本回答 ${detail.question.basicAnswers} 件）`
              : "読み込んでいます…"}
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {form && detail && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="arc-status">公開状態</Label>
                <SimpleSelect
                  id="arc-status"
                  disabled={disabled}
                  value={form.status}
                  onChange={(v) => set("status", v)}
                  options={[
                    { value: "published", label: "公開（サイトに出す）" },
                    { value: "stopped", label: "停止（サイトに出さない）" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="arc-field">分野</Label>
                <SimpleSelect id="arc-field" disabled={disabled} value={form.fieldId} onChange={(v) => set("fieldId", v)} options={ARCHIVE_FIELDS.map((f) => ({ value: f, label: ARCHIVE_FIELD_LABEL[f] }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="arc-difficulty">難易度</Label>
                <SimpleSelect<Form["difficulty"]>
                  id="arc-difficulty"
                  disabled={disabled}
                  value={form.difficulty}
                  onChange={(v) => set("difficulty", v)}
                  options={[
                    { value: "auto", label: `自動（今の判定：${ARCHIVE_DIFFICULTY_LABEL[detail.question.autoDifficulty ?? detail.question.difficulty]}）` },
                    ...FIXED_DIFFICULTIES.map((d) => ({ value: d, label: `${ARCHIVE_DIFFICULTY_LABEL[d]}に固定` })),
                  ]}
                />
              </div>
            </div>
            {form.difficulty !== "auto" && (
              <p className="-mt-3 text-xs text-muted-foreground">
                固定すると、サイトの表示・練習の絞り込み・テストの出題でこの難易度を使います。正答率の表示と自動の判定は続き、「自動」に戻すと判定の値になります。
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arc-text">問題文</Label>
              <Textarea id="arc-text" disabled={disabled} rows={3} value={form.text} onChange={(e) => set("text", e.target.value)} />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">選択肢と正解（C は空でもかまいません）</legend>
              {ARCHIVE_CHOICES.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="flex w-16 shrink-0 items-center gap-1.5 text-sm">
                    <input type="radio" name="arc-correct" disabled={disabled || !form.choices[k].trim()} checked={form.correct === k} onChange={() => set("correct", k)} className="accent-primary" />
                    {k}
                  </label>
                  <Input aria-label={`選択肢 ${k}`} disabled={disabled} value={form.choices[k]} onChange={(e) => set("choices", { ...form.choices, [k]: e.target.value })} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">丸を付けた選択肢が正解です。</p>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arc-exp">解説</Label>
              <Textarea id="arc-exp" disabled={disabled} rows={5} value={form.explanation} onChange={(e) => set("explanation", e.target.value)} />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">参考文献</legend>
              {form.references.map((r, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                  <Input aria-label="文献名" placeholder="文献名" disabled={disabled} value={r.title} onChange={(e) => set("references", form.references.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input aria-label="URL" placeholder="https://…" disabled={disabled} value={r.url} onChange={(e) => set("references", form.references.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  <Input aria-label="発行元" placeholder="発行元" disabled={disabled} value={r.publisher} onChange={(e) => set("references", form.references.map((x, j) => (j === i ? { ...x, publisher: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" aria-label="この参考文献を消す" disabled={disabled} onClick={() => set("references", form.references.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="self-start" disabled={disabled} onClick={() => set("references", [...form.references, { title: "", url: "", publisher: "" }])}>
                <Plus data-icon="inline-start" />
                参考文献を足す
              </Button>
            </fieldset>

            {changes.content && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="arc-reason">変更理由（版の記録に残ります）</Label>
                  <Input id="arc-reason" disabled={disabled} placeholder="例：誤字の修正、正解の訂正" value={form.changeReason} onChange={(e) => set("changeReason", e.target.value)} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox className="mt-1" disabled={disabled || changes.answer} checked={changes.answer || form.resetStats} onCheckedChange={(c) => set("resetStats", Boolean(c))} />
                  <span>
                    正答率を数え直す
                    <span className="block text-xs text-muted-foreground">
                      {changes.answer
                        ? "正解・選択肢を変えたので、必ず数え直します。新しい回答が10件たまるまでは、今の正答率・難易度を表示します。"
                        : "誤字の修正など、答えやすさが変わらないときは数え直さなくてかまいません。"}
                    </span>
                  </span>
                </label>
              </div>
            )}

            {answerFix && (
              <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <p>正解を変えました。参加者向けに訂正のお知らせを出しますか？</p>
                <Button
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    onDraftNotice({
                      kind: "correction",
                      title: `${detail.question.id} の正解を訂正しました`,
                      summary: `正解を「${answerFix.before}」から「${answerFix.after}」に訂正しました。`,
                      body: "",
                      questionId: detail.question.id,
                      before: answerFix.before,
                      after: answerFix.after,
                      publishedAt: "",
                      endsAt: "",
                    })
                  }
                >
                  訂正のお知らせを作る
                </Button>
              </div>
            )}

            {detail.reports.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">この問題への誤り報告</h3>
                <ul className="flex flex-col gap-2">
                  {detail.reports.map((r) => (
                    <li key={r.reportId} className="rounded-lg border border-border p-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={r.status === "received" ? "destructive" : "secondary"}>{ARCHIVE_REPORT_STATUS_LABEL[r.status]}</Badge>
                        <span>{ARCHIVE_REPORT_REASON_LABEL[r.reason] ?? r.reason}</span>
                        <span>{formatJst(r.createdAt)}</span>
                        {r.versionId && r.versionId !== detail.question.currentVersionId && <span>（{r.versionId} への報告）</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{r.detail || "（内容なし）"}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">報告の状態は「誤り報告」のタブで変えられます。</p>
              </section>
            )}

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">版の履歴（{detail.versions.length}）</summary>
              <ol className="mt-2 flex flex-col gap-2">
                {detail.versions.map((v) => (
                  <li key={v.versionId} className="rounded-md bg-muted/40 p-2 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{v.versionId}</span>
                      {v.versionId === detail.question.currentVersionId && <Badge variant="secondary">今の版</Badge>}
                      <span>{formatJst(v.createdAt)}</span>
                      <span>{v.createdBy}</span>
                      <span>{v.changeReason}</span>
                    </div>
                    <p className="mt-1">{v.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {ARCHIVE_CHOICES.filter((k) => v.choices[k]).map((k) => `${k}. ${v.choices[k]}${v.correct === k ? "（正解）" : ""}`).join("　")}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            閉じる
          </Button>
          {canEdit && form && (
            <Button disabled={saving || reasonMissing || !(changes.content || changes.meta)} onClick={save}>
              {saving ? "保存しています…" : changes.content ? "新しい版として保存" : "保存"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
