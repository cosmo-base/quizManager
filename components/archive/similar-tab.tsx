"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type { ArchiveSimilarCandidates, ArchiveSimilarCard } from "@/lib/services/gas-contract"
import { errorMessage } from "@/lib/archive"
import { ARCHIVE_PLATFORM_LABEL } from "@/lib/archive-filter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/states"

const PAGE = 100

type Candidate = ArchiveSimilarCandidates["candidates"][number]
const keyOf = (c: Candidate) => `${c.a.id}|${c.b.id}`

function Card({ q, onOpen }: { q: ArchiveSimilarCard; onOpen: (id: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button type="button" className="font-mono text-sm text-primary underline-offset-4 hover:underline" onClick={() => onOpen(q.id)}>
          {q.id}
        </button>
        <span>{q.postedOn}</span>
        <span>{q.platforms.map((p) => ARCHIVE_PLATFORM_LABEL[p] ?? p).join("・")}</span>
        {q.status === "stopped" && <Badge variant="destructive">停止中</Badge>}
        {q.similarGroup && <span className="rounded border border-border px-1 font-mono">似：{q.similarGroup}</span>}
      </div>
      <p className="whitespace-pre-wrap">{q.text}</p>
      <p className="text-xs text-muted-foreground">正解：{q.correctText}</p>
    </div>
  )
}

/** 似た問題の候補：運営が見て「まとめる（1回に1問まで）」か「違う（候補から外す）」を選ぶ */
export function ArchiveSimilarTab({ canEdit, onOpenQuestion }: { canEdit: boolean; onOpenQuestion: (id: string) => void }) {
  const { state } = useQuiz()
  const backend = getBackend(state.settings.dataMode)
  const [data, setData] = useState<ArchiveSimilarCandidates | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    backend
      .archiveSimilarCandidates(limit)
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [backend, limit])
  useEffect(() => load(), [load])

  const done = (c: Candidate) =>
    setData((d) => (d ? { total: Math.max(0, d.total - 1), candidates: d.candidates.filter((x) => keyOf(x) !== keyOf(c)) } : d))

  const merge = (c: Candidate) => {
    setBusy(keyOf(c))
    backend
      .archiveSimilarMerge(c.a.id, c.b.id)
      .then((r) => {
        done(c)
        toast.success(`${c.a.id} と ${c.b.id} をまとまり ${r.group} にしました`, { description: "1回の練習・テストに1問までになります" })
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusy(null))
  }
  const dismiss = (c: Candidate) => {
    setBusy(keyOf(c))
    backend
      .archiveSimilarDismiss(c.a.id, c.b.id)
      .then(() => {
        done(c)
        toast.success("候補から外しました")
      })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setBusy(null))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          問題文と正解が近い組み合わせを、近い順に並べています。同じ内容を別の媒体・別の日に出したものなら「まとめる」（1回の練習・テストに1問まで）、違えば「違う」（候補から外す）を選びます。
          {data && <span className="ml-1 text-foreground">残り {data.total} 組</span>}
        </p>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          読み込み直す
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {data === null ? (
        !error && <p className="text-sm text-muted-foreground">読み込んでいます…（はじめは数十秒かかることがあります）</p>
      ) : data.candidates.length === 0 ? (
        <EmptyState title="候補はありません" description="近い組み合わせは、すべてまとめたか外しました。" />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.candidates.map((c) => (
            <li key={keyOf(c)} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>近さ {Math.round(c.score * 100)}%</span>
                {c.hint && <Badge variant="outline">答えが出る組（すでに同じ回には出しません）</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card q={c.a} onOpen={onOpenQuestion} />
                <Card q={c.b} onOpen={onOpenQuestion} />
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy !== null} onClick={() => merge(c)}>
                    まとめる
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => dismiss(c)}>
                    違う
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.candidates.length && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={() => setLimit((l) => l + PAGE)}>
          もっと見る
        </Button>
      )}
    </div>
  )
}
