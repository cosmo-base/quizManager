"use client"

import { useQuiz } from "@/lib/store/quiz-store"
import { useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SimpleSelect, type SelectOption } from "@/components/shared/simple-select"
import {
  DIFFICULTY_LABEL,
  FACTCHECK_STATUS,
  PLATFORM_LABEL,
  PLATFORMS,
  POST_STATUS,
  QUESTION_STATUS,
} from "@/lib/constants"
import type { Category } from "@/lib/types"
import { activeFilterCount, EMPTY_FILTERS, type LibraryFilters } from "./library-utils"

function opts<T extends string>(record: Record<T, { label: string } | string>, allLabel = "すべて"): SelectOption<"all" | T>[] {
  return [
    { value: "all", label: allLabel },
    ...(Object.keys(record) as T[]).map((k) => {
      const v = record[k]
      return { value: k, label: typeof v === "string" ? v : v.label }
    }),
  ]
}

export function LibraryFilterBar({
  filters,
  onChange,
  categories,
}: {
  filters: LibraryFilters
  onChange: (f: LibraryFilters) => void
  categories: Category[]
}) {
  const [expanded, setExpanded] = useState(false)
  const live = useQuiz().state.settings.dataMode === "live"
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => onChange({ ...filters, [key]: value })
  const count = activeFilterCount(filters)
  const { auto: _auto, ...difficulties } = DIFFICULTY_LABEL

  return (
    <section aria-label="検索・フィルター" className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={filters.keyword}
            onChange={(e) => set("keyword", e.target.value)}
            placeholder="問題文・選択肢・解説を検索"
            aria-label="キーワード"
            className="pl-8"
          />
        </div>
        <Input
          value={filters.idQuery}
          onChange={(e) => set("idQuery", e.target.value)}
          placeholder="問題ID / 知識ID"
          aria-label="問題IDまたは知識ID"
          className="w-40 font-mono"
        />
        <SimpleSelect
          aria-label="媒体"
          className="w-36"
          value={filters.platform}
          onChange={(v) => set("platform", v)}
          options={[{ value: "all", label: "全媒体" }, ...PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))]}
        />
        <SimpleSelect
          aria-label="問題状態"
          className="w-36"
          value={filters.status}
          onChange={(v) => set("status", v)}
          options={opts(QUESTION_STATUS, "全状態")}
        />
        <Button variant="outline" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <SlidersHorizontal />
          詳細条件{count > 0 ? `（${count}）` : ""}
        </Button>
        {count > 0 && (
          <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            <X />
            クリア
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-4 xl:grid-cols-6">
          <Field label="題材" id="f-topic">
            <Input id="f-topic" value={filters.topic} onChange={(e) => set("topic", e.target.value)} placeholder="例：惑星" />
          </Field>
          <Field label="分類" id="f-cat">
            <SimpleSelect
              id="f-cat"
              value={filters.categoryId}
              onChange={(v) => set("categoryId", v)}
              options={[{ value: "all", label: "すべて" }, ...categories.map((c) => ({ value: c.id, label: c.name })), { value: "none", label: "未設定" }]}
            />
          </Field>
          <Field label="難易度" id="f-diff">
            <SimpleSelect id="f-diff" value={filters.difficulty} onChange={(v) => set("difficulty", v)} options={[...opts(difficulties), { value: "auto", label: "未設定" }]} />
          </Field>
          <Field label="出題日（から）" id="f-from">
            <Input id="f-from" type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </Field>
          <Field label="出題日（まで）" id="f-to">
            <Input id="f-to" type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </Field>
          <Field label="回答数（以上）" id="f-resp">
            <Input
              id="f-resp"
              type="number"
              min={0}
              inputMode="numeric"
              value={filters.minResponses}
              onChange={(e) => set("minResponses", e.target.value)}
            />
          </Field>
          <Field label="正答率" id="f-rate">
            <SimpleSelect
              id="f-rate"
              value={filters.rate}
              onChange={(v) => set("rate", v)}
              options={[
                { value: "all", label: "すべて" },
                { value: "low", label: "30%未満（難しい）" },
                { value: "mid", label: "30〜70%" },
                { value: "high", label: "70%超（易しい）" },
                { value: "none", label: "未取得" },
              ]}
            />
          </Field>
          <Field label="検証状態" id="f-fc">
            <SimpleSelect id="f-fc" value={filters.factCheck} onChange={(v) => set("factCheck", v)} options={opts(FACTCHECK_STATUS)} />
          </Field>
          <Field label="投稿状態" id="f-post">
            <SimpleSelect
              id="f-post"
              value={filters.postStatus}
              onChange={(v) => set("postStatus", v)}
              options={[{ value: "all", label: "すべて" }, { value: "none", label: "投稿なし" }, ...opts(POST_STATUS).slice(1)]}
            />
          </Field>
          {/* 本番は再出題をしないので出さない */}
          {!live && (
          <Field label="再出題可否" id="f-reuse">
            <SimpleSelect
              id="f-reuse"
              value={filters.reuse}
              onChange={(v) => set("reuse", v)}
              options={[
                { value: "all", label: "すべて" },
                { value: "ok", label: "再出題可能" },
                { value: "blocked", label: "制限期間中" },
              ]}
            />
          </Field>
          )}
        </div>
      )}
    </section>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
