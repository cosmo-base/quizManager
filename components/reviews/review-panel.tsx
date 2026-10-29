"use client"

import { PostTextPreview } from "@/components/shared/post-text-preview"

import { useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, Pencil, RefreshCw, Undo2, WandSparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { CHECK, REVIEW_ACTION } from "@/components/questions/detail-tabs"
import { EditQuestionDialog } from "@/components/questions/detail-dialogs"
import { QUESTION_DIFFICULTY_LABEL, FACTCHECK_STATUS, IMAGE_STATUS, SOURCE_TIER_LABEL } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import type { Question, QualityScore } from "@/lib/types"
import { can } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { LiveReturnNotice, SimilarWarning } from "@/components/questions/live-suggestion"
import { questionHref } from "@/lib/routes"

const QUALITY_LABEL: Record<keyof QualityScore, string> = {
  interest: "興味喚起",
  answerability: "回答しやすさ",
  choiceValidity: "選択肢の妥当性",
  learning: "学び",
  platformFit: "媒体適合",
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

type NoteKind = "return" | "reject" | "manual" | null

export function ReviewPanel({ q }: { q: Question }) {
  const { state, actions } = useQuiz()
  const categoryName = useCategoryName()
  const [editing, setEditing] = useState(false)
  const [noteKind, setNoteKind] = useState<NoteKind>(null)
  const [note, setNote] = useState("")
  const [verifying, setVerifying] = useState(false)

  const canApprove = can(state.role, "approve")
  const canEdit = can(state.role, "edit")
  // 未検証・検証NG は承認できない（本番も同じ。GAS でも確かめる）。要確認は懸念点を読んだうえで承認できる
  const isLive = state.settings.dataMode === "live"
  const aiReady = !!state.liveStatus.ai?.configured
  const unverified = q.factCheck.status === "pending" || q.factCheck.status === "running" || q.factCheck.status === "failed"
  // 実APIモード：未検証（検証NG ではない）なら、理由を書いて人の判断で承認できる
  const manualApprovable = isLive && q.factCheck.status === "pending"

  const reverify = async () => {
    setVerifying(true)
    try {
      await actions.reverify(q.id)
    } finally {
      setVerifying(false)
    }
  }

  const submitNote = () => {
    if (!note.trim()) return
    if (noteKind === "return") actions.returnQuestion(q.id, note.trim())
    if (noteKind === "reject") actions.rejectQuestion(q.id, note.trim())
    if (noteKind === "manual") actions.approve(q.id, "", note.trim())
    setNoteKind(null)
    setNote("")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <PlatformMark platform={q.platform} />
        <Link href={questionHref(q.id)} className="font-mono text-sm text-primary hover:underline">
          {q.id}
        </Link>
        <span className="text-xs text-muted-foreground">
          {categoryName(q.categoryId)} ・ {QUESTION_DIFFICULTY_LABEL[q.difficulty]}
          {q.topic && ` ・ ${q.topic}`} ・ v{isLive ? q.versions[0]?.version : q.versions.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => actions.regenerateQuestion(q.id)} disabled={(isLive && !aiReady) || !can(state.role, "generate")}>
            <WandSparkles />
            別問題を生成
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNoteKind("reject")} disabled={!canApprove && !canEdit}>
            <X />
            不採用
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNoteKind("return")} disabled={!canApprove}>
            <Undo2 />
            差し戻し
          </Button>
          <Button size="sm" variant="outline" onClick={reverify} disabled={(isLive && !aiReady) || verifying || (!canApprove && !canEdit)}>
            <RefreshCw className={verifying ? "animate-spin" : undefined} />
            再検証
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={!canEdit}>
            <Pencil />
            修正
          </Button>
          {manualApprovable && (
            <Button size="sm" variant="outline" onClick={() => setNoteKind("manual")} disabled={!canApprove || q.status !== "review"}>
              <Check />
              ファクトチェックなしで承認
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => actions.approve(q.id)}
            disabled={!canApprove || unverified || q.status !== "review"}
            title={unverified ? (q.factCheck.status === "failed" ? "検証NGの問題は承認できません。修正して再検証してください" : manualApprovable ? "未検証です。再検証するか、「ファクトチェックなしで承認」から理由を書いて承認してください" : "未検証の問題は承認できません。先に再検証してください") : undefined}
          >
            <Check />
            承認
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-2 xl:divide-x xl:overflow-hidden">
        <div className="flex flex-col gap-5 p-4 xl:overflow-y-auto">
          {isLive && <LiveReturnNotice q={q} />}
          <Block title="問題">
            <p className="text-base leading-relaxed text-pretty">{q.text}</p>
            {isLive && <SimilarWarning text={q.text} answerText={q.choices.find((c) => c.label === q.answer)?.text} exclude={q.id} className="mt-2" />}
          </Block>
          <Block title="選択肢">
            <ol className="flex flex-col gap-1.5">
              {q.choices.map((c) => {
                const correct = c.label === q.answer
                return (
                  <li
                    key={c.label}
                    className={cn(
                      "flex items-start gap-3 rounded-md border px-3 py-2 text-sm",
                      correct ? "border-success/40 bg-success/10" : "bg-muted/30",
                    )}
                  >
                    <span className={cn("font-mono font-semibold", correct && "text-success")}>{c.label}</span>
                    <span className="flex-1">{c.text}</span>
                    {correct && <span className="text-xs font-medium text-success">正解</span>}
                  </li>
                )
              })}
            </ol>
          </Block>
          <Block title="解説">
            <p className="text-sm leading-relaxed text-pretty">{q.explanation}</p>
          </Block>
          {isLive ? (
            <Block title="投稿内容プレビュー">
            <PostTextPreview q={q} />
          </Block>
          ) : (
          <Block title="投稿画像プレビュー">
            <div className="flex max-w-sm flex-col gap-2">
              <div className="flex aspect-square flex-col justify-between rounded-md border bg-primary p-4 text-primary-foreground">
                <span className="font-mono text-xs opacity-80">{q.id}</span>
                <p className="line-clamp-5 text-sm leading-relaxed font-medium text-balance">{q.text}</p>
                <div className="flex flex-col gap-1 text-xs">
                  {q.choices.map((c) => (
                    <span key={c.label} className="truncate rounded bg-primary-foreground/15 px-2 py-1">
                      {c.label}. {c.text}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <StatusBadge {...IMAGE_STATUS[q.imageStatus]} />
                <span className="tabular-nums">
                  画像 {q.imageVersion ? `v${q.imageVersion}` : "未生成"} / 本文 v{q.versions.length}
                </span>
              </div>
            </div>
          </Block>
          )}
        </div>

        <div className="flex flex-col gap-5 border-t p-4 xl:overflow-y-auto xl:border-t-0">
          <Block title="検証結果">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
              {q.factCheck.model && <span className="font-mono">{q.factCheck.model}</span>}
              {q.factCheck.checkedAt && <span className="tabular-nums">{formatDateTime(q.factCheck.checkedAt)}</span>}
            </div>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {q.factCheck.items.map((it) => (
                <li key={it.key} className="flex items-start gap-2 text-sm">
                  <StatusBadge {...CHECK[it.result]} className="shrink-0" />
                  <span className="flex flex-col">
                    {it.label}
                    {it.note && <span className="text-xs text-muted-foreground">{it.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {!q.autoApprovable && q.autoApprovalBlockers.length > 0 && (
              <p className="text-xs text-muted-foreground">自動承認対象外：{q.autoApprovalBlockers.join(" / ")}</p>
            )}
          </Block>

          {q.factCheck.concerns.length > 0 && (
            <Block title="AIの懸念">
              <ul className="flex list-disc flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 py-2 pr-3 pl-7 text-sm">
                {q.factCheck.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Block>
          )}

          <Block title="品質スコア">
            <dl className="flex flex-col gap-1.5">
              {(Object.keys(QUALITY_LABEL) as (keyof QualityScore)[]).map((k) => (
                <div key={k} className="grid grid-cols-[7rem_1fr_1.5rem] items-center gap-2 text-sm">
                  <dt className="text-muted-foreground">{QUALITY_LABEL[k]}</dt>
                  <dd className="flex gap-1" aria-label={`5段階中${q.quality[k]}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= q.quality[k] ? "bg-primary" : "bg-muted")} />
                    ))}
                  </dd>
                  <span className="text-right tabular-nums">{q.quality[k]}</span>
                </div>
              ))}
            </dl>
          </Block>

          <Block title="出典・根拠">
            {q.sources.length === 0 ? (
              <p className="text-sm text-destructive">出典がありません（自動承認不可）</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {q.sources.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={SOURCE_TIER_LABEL[s.tier]} tone={s.tier <= 2 ? "success" : "warning"} />
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {s.title}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                    <blockquote className="border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground">{s.excerpt}</blockquote>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="類似過去問">
            {q.duplicate.similar.length === 0 ? (
              <p className="text-sm text-muted-foreground">類似問題はありません</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {q.duplicate.similar.map((s) => (
                  <li key={s.questionId} className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <PlatformMark platform={s.platform} />
                      <Link href={questionHref(s.questionId)} className="font-mono text-primary hover:underline">
                        {s.questionId}
                      </Link>
                      {s.sameKnowledge && <StatusBadge label="同一知識" tone="warning" />}
                      <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(s.similarity * 100)}%</span>
                    </div>
                    <p className="truncate">{s.text}</p>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <Block title="承認履歴">
            <ol className="flex flex-col gap-2">
              {[...q.reviewHistory].reverse().map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex flex-col border-l-2 pl-3 text-sm">
                  <span>
                    <span className="font-medium">{REVIEW_ACTION[r.action]}</span>
                    <span className="text-muted-foreground"> ・ {r.by} ・ </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(r.at)}</span>
                  </span>
                  {r.note && <span className="text-muted-foreground">{r.note}</span>}
                </li>
              ))}
            </ol>
          </Block>
        </div>
      </div>

      <EditQuestionDialog key={`edit-${q.id}-${q.updatedAt}`} q={q} open={editing} onOpenChange={setEditing} />
      <Dialog open={noteKind !== null} onOpenChange={(o) => !o && setNoteKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteKind === "reject" ? "不採用にする" : noteKind === "manual" ? "ファクトチェックなしで承認する" : "差し戻す"}</DialogTitle>
            <DialogDescription>
              {noteKind === "reject"
                ? "この問題は採用されず、割り当て済みの枠は空き枠に戻ります。"
                : noteKind === "manual"
                  ? "AI のファクトチェックをせずに、あなたの判断で承認します。どう確かめたかを書いてください（バージョン履歴のメモに「人の判断で承認」として残ります）。"
                  : "作成者に修正を依頼します。理由は承認履歴に残ります。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-note">{noteKind === "manual" ? "承認の理由" : "理由"}</Label>
            <Textarea
              id="review-note"
              value={note}
              maxLength={noteKind === "manual" ? 200 : undefined}
              placeholder={noteKind === "manual" ? "例：JAXA の公式ページで数値を確認した" : undefined}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteKind(null)}>
              キャンセル
            </Button>
            <Button variant={noteKind === "reject" ? "destructive" : "default"} onClick={submitNote} disabled={!note.trim()}>
              {noteKind === "reject" ? "不採用にする" : noteKind === "manual" ? "承認する" : "差し戻す"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
