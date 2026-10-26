"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useQuiz } from "@/lib/store/quiz-store"
import { QUESTION_STATUS } from "@/lib/constants"
import { StatusBadge } from "@/components/shared/status-badge"
import { PlatformMark } from "@/components/shared/platform-badge"

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { data } = useQuiz()
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.questions.slice(0, 6)
    return data.questions
      .filter((x) => [x.id, x.knowledgeId, x.text, x.topic, ...x.choices.map((c) => c.text)].some((t) => t.toLowerCase().includes(q)))
      .slice(0, 12)
  }, [query, data.questions])

  const go = (id: string) => {
    setOpen(false)
    setQuery("")
    router.push(`/questions/${id}`)
  }

  return (
    <>
      <Button variant="outline" className="h-9 w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-64 sm:px-3" onClick={() => setOpen(true)} aria-label="問題を検索">
        <Search className="mx-auto size-4 sm:mx-0" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">問題ID・本文・知識IDで検索</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>問題を検索</DialogTitle>
            <DialogDescription>問題ID、知識ID、問題文、選択肢で検索できます</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例：Q-2026-0157 / はやぶさ / K-ISS"
            aria-label="検索キーワード"
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "Enter" && results[0]) go(results[0].id)
            }}
          />
          <ul className="flex max-h-80 flex-col overflow-y-auto" aria-label="検索結果">
            {results.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">該当する問題はありません</li>}
            {results.map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => go(q.id)} className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                  <PlatformMark platform={q.platform} className="mt-0.5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">{q.id}</span>
                    <span className="truncate text-sm">{q.text}</span>
                  </span>
                  <StatusBadge {...QUESTION_STATUS[q.status]} />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
