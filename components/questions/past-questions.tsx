"use client"

// 過去問：以前のスプレッドシート「宇宙クイズ」の KPI タブで出した問題（GAS の importPastQuestions で正本の past_questions に写したもの）。
// 問題ライブラリ・予備・KPI には混ぜず、かぶり（似た問題）の確認と検索だけに使う。
import { useMemo, useState } from "react"
import { History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { normalizeQuestionText } from "@/lib/question-validate"
import type { GasPastQuestion } from "@/lib/services/gas-contract"
import { SIMILAR_WARN } from "@/lib/similarity"
import { usePastQuestions, useQuiz } from "@/lib/store/quiz-store"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

/** 1 問分（類似の一覧・検索の一覧で共通） */
export function PastQuestionRow({ p, score }: { p: GasPastQuestion; score?: number }) {
  const rate = p.answers > 0 ? Math.round((p.correct / p.answers) * 100) : null
  return (
    <li className="flex items-start gap-3 py-2 text-sm first:pt-0 last:pb-0">
      <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{p.date ?? "日付なし"}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2">{p.text}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {p.choices.map((c, i) => `${"①②③"[i]} ${c}`).join("　")}
          {p.answer && <span className="ml-2 text-foreground">正解：{p.answer}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[p.category, p.platforms.join("・"), p.answers > 0 ? `回答 ${p.answers}${rate !== null ? `・正答率 ${rate}%` : ""}` : ""].filter(Boolean).join(" ／ ")}
        </p>
      </div>
      {score !== undefined && (
        <span className={cn("w-20 shrink-0 text-right text-xs tabular-nums", score >= SIMILAR_WARN ? "font-medium text-warning" : "text-muted-foreground")}>近さ {Math.round(score * 100)}%</span>
      )}
    </li>
  )
}

/** 問題ライブラリの「過去問」ボタン：検索の一覧と、取り込み */
export function PastQuestionsButton() {
  const [open, setOpen] = useState(false)
  const past = usePastQuestions()
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <History />
        過去問（{past.length}）
      </Button>
      {open && <PastQuestionsDialog open onOpenChange={setOpen} />}
    </>
  )
}

function PastQuestionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, actions, can } = useQuiz()
  const past = usePastQuestions()
  const loaded = state.liveStatus.pastQuestions !== null
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [importing, setImporting] = useState(false)

  const results = useMemo(() => {
    const words = query.split(/[\s　]+/).map(normalizeQuestionText).filter(Boolean)
    const list = words.length
      ? past.filter((p) => {
          const hay = normalizeQuestionText([p.text, ...p.choices, p.answer, p.category, p.date ?? ""].join(" "))
          return words.every((w) => hay.includes(w))
        })
      : past
    return [...list].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  }, [past, query])

  const runImport = async () => {
    setImporting(true)
    await actions.importLivePastQuestions()
    setImporting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>過去問（{past.length} 問）</DialogTitle>
          <DialogDescription>
            以前のスプレッドシート「宇宙クイズ」で出した問題です。問題ライブラリ・予備・KPI には混ざらず、似た問題の注意と AI 生成の重複判定に使います。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="過去問を検索"
            placeholder="問題文・選択肢・正解・分類・日付で検索"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE_SIZE)
            }}
            className="min-w-0 flex-1"
          />
          <Button variant="outline" onClick={runImport} disabled={importing || !can("post")} title="KPI シートの以前の行のうち、まだ取り込んでいない行を足します">
            {importing ? "取り込み中…" : "KPI シートから取り込む"}
          </Button>
        </div>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">過去問を読み込めませんでした。GAS を最新のコードで「新しいバージョン」としてデプロイしてください。</p>
        ) : past.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ過去問がありません。「KPI シートから取り込む」を押すか、GAS のエディタで importPastQuestions を実行してください（スクリプトプロパティ KPI_SHEET_ID が要ります）。</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
              {results.length} 件{results.length > limit ? `（新しい順に ${limit} 件を表示）` : ""}
            </p>
            <ul className="flex flex-col divide-y">
              {results.slice(0, limit).map((p) => (
                <PastQuestionRow key={p.id} p={p} />
              ))}
            </ul>
            {results.length > limit && (
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                さらに表示
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
