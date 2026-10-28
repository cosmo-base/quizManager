"use client"

// 実APIモードの問題詳細：全版の履歴（GAS の getQuestionHistory）、版ごとのメモ（差し戻し・不採用の理由など）、
// 類似・関連問題（問題文の近さと同じ題材。Gemini は使わない）。
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { DIFFICULTY_LABEL, QUESTION_STATUS } from "@/lib/constants"
import { formatDate, formatDateTime } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import type { GasQuestion } from "@/lib/services/gas-contract"
import { findSimilar, SIMILAR_WARN } from "@/lib/similarity"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import type { Question } from "@/lib/types"
import { cn } from "@/lib/utils"

/** 問題の全版（古い順）。版が増えたら読み直す */
export function useLiveHistory(q: Question): { history: GasQuestion[] | null; loading: boolean } {
  const { actions } = useQuiz()
  const [history, setHistory] = useState<GasQuestion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const version = q.versions[0]?.version
  useEffect(() => {
    let alive = true
    setLoading(true)
    void actions.loadLiveHistory(q.id).then((h) => {
      if (!alive) return
      setHistory(h)
      setLoading(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id, version])
  return { history, loading }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>

/** 版ごとのメモ（差し戻し・不採用・確認依頼・AI の案の反映など）。新しい順 */
export function LiveNoteHistory({ history, loading }: { history: GasQuestion[] | null; loading: boolean }) {
  if (loading) return <Empty>読み込み中…</Empty>
  const notes = (history ?? []).filter((v) => v.note).reverse()
  if (notes.length === 0) return <Empty>メモの付いた版はありません</Empty>
  return (
    <ol className="flex flex-col gap-3">
      {notes.map((v) => (
        <li key={v.version} className="flex flex-col gap-0.5 border-l-2 pl-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge {...QUESTION_STATUS[v.status]} />
            <span className="font-mono text-xs text-muted-foreground">v{v.version}</span>
            <span className="text-muted-foreground">{v.savedBy}</span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{v.savedAt ? formatDateTime(v.savedAt) : "—"}</span>
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{v.note}</p>
        </li>
      ))}
    </ol>
  )
}

type Field = { label: string; value: (v: GasQuestion) => string; long?: boolean }

export function LiveVersionsTab({ history, loading }: { history: GasQuestion[] | null; loading: boolean }) {
  const categoryName = useCategoryName()
  if (loading) return <Section title="バージョン履歴"><Empty>読み込み中…</Empty></Section>
  if (!history || history.length === 0) return <Section title="バージョン履歴"><Empty>履歴を読み込めませんでした</Empty></Section>
  const fields: Field[] = [
    { label: "状態", value: (v) => QUESTION_STATUS[v.status].label },
    { label: "出題日", value: (v) => (v.plannedDate ? formatDate(v.plannedDate) : "未設定") },
    { label: "問題文", value: (v) => v.text, long: true },
    { label: "選択肢", value: (v) => v.choices.map((c) => `${c.label}. ${c.text}`).join(" / "), long: true },
    { label: "正解", value: (v) => v.answer },
    { label: "解説", value: (v) => v.explanation, long: true },
    { label: "難易度", value: (v) => (v.difficulty ? DIFFICULTY_LABEL[v.difficulty] : "未設定") },
    { label: "分類", value: (v) => (v.category ? categoryName(v.category) : "未設定") },
    { label: "題材", value: (v) => v.topic || "未設定" },
  ]
  const versions = [...history].reverse()
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((v, i) => {
        const prev = versions[i + 1]
        const changed = prev ? fields.filter((f) => f.value(prev) !== f.value(v)) : []
        return (
          <li key={v.version}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                <CardTitle className="font-mono text-sm">v{v.version}</CardTitle>
                {i === 0 && <StatusBadge label="最新" tone="info" hideIcon />}
                <StatusBadge {...QUESTION_STATUS[v.status]} />
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {v.savedBy} ・ {v.savedAt ? formatDateTime(v.savedAt) : "—"}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {v.note && <p className="rounded-md bg-muted/50 px-2 py-1 text-muted-foreground">メモ：{v.note}</p>}
                {!prev ? (
                  <p className="text-xs text-muted-foreground">最初の版</p>
                ) : changed.length === 0 ? (
                  <p className="text-xs text-muted-foreground">内容の変更はありません</p>
                ) : (
                  changed.map((f) => (
                    <div key={f.label} className="grid grid-cols-[4rem_1fr] gap-2">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <div className={cn("flex gap-1", f.long ? "flex-col" : "flex-wrap items-center")}>
                        <del className="rounded bg-destructive/10 px-2 py-0.5 text-muted-foreground">{f.value(prev)}</del>
                        {!f.long && <span aria-hidden>→</span>}
                        <ins className="rounded bg-success/10 px-2 py-0.5 no-underline">{f.value(v)}</ins>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

function QuestionRow({ o, right }: { o: Question; right?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <PlatformMark platform={o.platform} />
      <Link href={questionHref(o.id)} className="font-mono text-xs text-primary hover:underline">
        {o.id}
      </Link>
      <span className="min-w-0 flex-1 truncate">{o.text}</span>
      <StatusBadge {...QUESTION_STATUS[o.status]} />
      {right}
    </li>
  )
}

export function LiveRelatedTab({ q, questions }: { q: Question; questions: Question[] }) {
  const similar = findSimilar(q.text, questions, { exclude: q.id })
  const sameTopic = q.topic ? questions.filter((o) => o.id !== q.id && o.topic === q.topic && !similar.some((h) => h.item.id === o.id)) : []
  return (
    <div className="flex flex-col gap-4">
      <Section title={`問題文が似ている問題（${similar.length}）`}>
        {similar.length === 0 ? (
          <Empty>似ている問題は見つかりませんでした</Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {similar.map((h) => (
              <QuestionRow
                key={h.item.id}
                o={h.item}
                right={
                  <span className={cn("w-20 text-right text-xs tabular-nums", h.score >= SIMILAR_WARN ? "font-medium text-warning" : "text-muted-foreground")}>
                    近さ {Math.round(h.score * 100)}%
                  </span>
                }
              />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">問題文の文字の並びの近さで探しています（{Math.round(SIMILAR_WARN * 100)}% 以上はよく似た問題）。意味が同じでも言い回しが大きく違うものは見つけられません。</p>
      </Section>
      <Section title={q.topic ? `同じ題材「${q.topic}」の問題（${sameTopic.length}）` : "同じ題材の問題"}>
        {!q.topic ? (
          <Empty>この問題は題材が未設定です</Empty>
        ) : sameTopic.length === 0 ? (
          <Empty>同じ題材の問題はほかにありません</Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {sameTopic.map((o) => (
              <QuestionRow key={o.id} o={o} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
