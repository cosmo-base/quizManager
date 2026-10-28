"use client"

import { useQuiz } from "@/lib/store/quiz-store"
import { PostTextPreview } from "@/components/shared/post-text-preview"

import { questionHref } from "@/lib/routes"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  QUESTION_DIFFICULTY_LABEL,
  FACTCHECK_STATUS,
  IMAGE_STATUS,
  PLATFORM_LABEL,
  POST_STATUS,
  QUESTION_STATUS,
  SOURCE_TIER_LABEL,
  type Tone,
} from "@/lib/constants"
import { formatCount, formatDateTime, formatPercent } from "@/lib/format"
import type { CheckResult, PostJob, Question, ReviewEntry, SystemSettings } from "@/lib/types"
import { cn } from "@/lib/utils"
import { responseStats, reusableDate } from "./library-utils"

export const CHECK: Record<CheckResult, { label: string; tone: Tone }> = {
  pass: { label: "OK", tone: "success" },
  warn: { label: "要確認", tone: "warning" },
  fail: { label: "NG", tone: "danger" },
  pending: { label: "未実施", tone: "muted" },
}

export const REVIEW_ACTION: Record<ReviewEntry["action"], string> = {
  generated: "生成",
  approved: "承認",
  returned: "差し戻し",
  rejected: "不採用",
  edited: "編集",
  reverified: "再検証",
  auto_approved: "自動承認",
  scheduled: "予約",
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function QuestionDetailTabs({
  q,
  questions,
  postJobs,
  categoryName,
  rules,
  today,
}: {
  q: Question
  questions: Question[]
  postJobs: PostJob[]
  categoryName: (id: string) => string
  rules: SystemSettings["rules"]
  today: string
}) {
  return (
    <Tabs defaultValue="content" className="flex flex-col gap-4">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="content">問題内容</TabsTrigger>
        <TabsTrigger value="sources">出典・検証</TabsTrigger>
        <TabsTrigger value="related">類似・関連問題</TabsTrigger>
        <TabsTrigger value="history">出題履歴</TabsTrigger>
        <TabsTrigger value="results">回答実績</TabsTrigger>
        <TabsTrigger value="versions">バージョン履歴</TabsTrigger>
      </TabsList>
      <TabsContent value="content">
        <ContentTab q={q} categoryName={categoryName} />
      </TabsContent>
      <TabsContent value="sources">
        <SourcesTab q={q} />
      </TabsContent>
      <TabsContent value="related">
        <RelatedTab q={q} questions={questions} rules={rules} today={today} />
      </TabsContent>
      <TabsContent value="history">
        <HistoryTab q={q} postJobs={postJobs} />
      </TabsContent>
      <TabsContent value="results">
        <ResultsTab q={q} />
      </TabsContent>
      <TabsContent value="versions">
        <VersionsTab q={q} />
      </TabsContent>
    </Tabs>
  )
}

function ContentTab({ q, categoryName }: { q: Question; categoryName: (id: string) => string }) {
  // 実APIモードの投稿は画像なし。画像の代わりに実際に投稿される本文を出す
  const live = useQuiz().state.settings.dataMode === "live"
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Section title="問題">
        <div className="flex flex-col gap-4">
          <p className="text-base leading-relaxed text-pretty">{q.text}</p>
          <ol className="flex flex-col gap-2" aria-label="選択肢">
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
                  <span className="flex-1 leading-relaxed">{c.text}</span>
                  {correct && <StatusBadge label="正解" tone="success" />}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-col gap-1.5 border-t pt-4">
            <h3 className="text-xs font-medium text-muted-foreground">解説</h3>
            <p className="text-sm leading-relaxed text-pretty">{q.explanation}</p>
          </div>
        </div>
      </Section>
      <div className="flex flex-col gap-4">
        <Section title="属性">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">知識ID</dt>
            <dd className="font-mono text-xs">{q.knowledgeId}</dd>
            <dt className="text-muted-foreground">題材</dt>
            <dd>{q.topic}</dd>
            <dt className="text-muted-foreground">分類</dt>
            <dd>{categoryName(q.categoryId)}</dd>
            <dt className="text-muted-foreground">難易度</dt>
            <dd>{QUESTION_DIFFICULTY_LABEL[q.difficulty]}</dd>
            <dt className="text-muted-foreground">媒体</dt>
            <dd>
              <PlatformMark platform={q.platform} />
            </dd>
            <dt className="text-muted-foreground">作成</dt>
            <dd className="tabular-nums">{formatDateTime(q.createdAt)}</dd>
            <dt className="text-muted-foreground">更新</dt>
            <dd className="tabular-nums">{formatDateTime(q.updatedAt)}</dd>
          </dl>
        </Section>
        {live ? (
          <Section title="投稿内容プレビュー">
            <PostTextPreview q={q} />
          </Section>
        ) : (
        <Section title="投稿画像">
          <div className="flex flex-col gap-3">
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
            <div className="flex items-center justify-between text-xs">
              <StatusBadge {...IMAGE_STATUS[q.imageStatus]} />
              <span className="text-muted-foreground tabular-nums">
                {q.imageVersion ? `v${q.imageVersion}` : "未生成"}
                {q.confirmedVersion ? ` / 確定 v${q.confirmedVersion}` : ""}
              </span>
            </div>
          </div>
        </Section>
        )}
      </div>
    </div>
  )
}

function SourcesTab({ q }: { q: Question }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="出典" className="lg:col-span-2">
        {q.sources.length === 0 ? (
          <Empty>出典が登録されていません</Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {q.sources.map((s) => (
              <li key={s.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={SOURCE_TIER_LABEL[s.tier]} tone={s.tier <= 2 ? "success" : "warning"} />
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {s.title}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <span className="text-xs text-muted-foreground">{s.publisher}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">確認 {formatDateTime(s.checkedAt)}</span>
                </div>
                <blockquote className="border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground">{s.excerpt}</blockquote>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="AI判定">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
            {q.factCheck.model && <span className="font-mono">{q.factCheck.model}</span>}
            {q.factCheck.checkedAt && <span className="tabular-nums">{formatDateTime(q.factCheck.checkedAt)}</span>}
          </div>
          <ul className="flex flex-col gap-2">
            {q.factCheck.items.map((it) => (
              <li key={it.key} className="flex items-start gap-2 text-sm">
                <StatusBadge {...CHECK[it.result]} className="shrink-0" />
                <div className="flex flex-col">
                  <span>{it.label}</span>
                  {it.note && <span className="text-xs text-muted-foreground">{it.note}</span>}
                </div>
              </li>
            ))}
          </ul>
          {q.factCheck.concerns.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="mb-1 font-medium">懸念点</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {q.factCheck.concerns.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>
      <Section title="承認履歴">
        {q.reviewHistory.length === 0 ? (
          <Empty>履歴がありません</Empty>
        ) : (
          <ol className="flex flex-col gap-3">
            {[...q.reviewHistory].reverse().map((r, i) => (
              <li key={`${r.at}-${i}`} className="flex flex-col gap-0.5 border-l-2 pl-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{REVIEW_ACTION[r.action]}</span>
                  <span className="text-muted-foreground">{r.by}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(r.at)}</span>
                </div>
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  )
}

function RelatedTab({
  q,
  questions,
  rules,
  today,
}: {
  q: Question
  questions: Question[]
  rules: SystemSettings["rules"]
  today: string
}) {
  const sameKnowledge = questions.filter((o) => o.id !== q.id && o.knowledgeId === q.knowledgeId)
  const sameTopic = questions.filter((o) => o.id !== q.id && o.knowledgeId !== q.knowledgeId && o.topic === q.topic)
  const ownReuse = reusableDate(q, rules)

  const list = (items: Question[], empty: string) =>
    items.length === 0 ? (
      <Empty>{empty}</Empty>
    ) : (
      <ul className="flex flex-col divide-y">
        {items.map((o) => {
          const from = reusableDate(o, rules)
          return (
            <li key={o.id} className="flex items-center gap-3 py-2 text-sm first:pt-0 last:pb-0">
              <PlatformMark platform={o.platform} />
              <Link href={questionHref(o.id)} className="font-mono text-xs text-primary hover:underline">
                {o.id}
              </Link>
              <span className="min-w-0 flex-1 truncate">{o.text}</span>
              <StatusBadge {...QUESTION_STATUS[o.status]} />
              <span className={cn("w-24 text-right font-mono text-xs tabular-nums", from && from <= today ? "text-success" : "text-muted-foreground")}>
                {from ?? "—"}
              </span>
            </li>
          )
        })}
      </ul>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">この問題の再出題可能日</span>
        <span className="font-mono tabular-nums">{ownReuse ?? "未出題"}</span>
        <span className="text-xs text-muted-foreground">
          同一媒体 {rules.sameplatformMonths}ヶ月 / 他媒体 {rules.crossPlatformMonths}ヶ月
        </span>
      </div>
      <Section title="AIが検出した類似問題">
        {q.duplicate.similar.length === 0 ? (
          <Empty>類似問題は検出されていません</Empty>
        ) : (
          <ul className="flex flex-col divide-y">
            {q.duplicate.similar.map((s) => (
              <li key={s.questionId} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformMark platform={s.platform} />
                  <Link href={questionHref(s.questionId)} className="font-mono text-xs text-primary hover:underline">
                    {s.questionId}
                  </Link>
                  {s.sameKnowledge && <StatusBadge label="同一知識" tone="warning" />}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    類似度 {Math.round(s.similarity * 100)}% ・ 再出題可能 {s.reusableFrom}
                  </span>
                </div>
                <p className="truncate">{s.text}</p>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={`同一知識（${sameKnowledge.length}）`}>{list(sameKnowledge, "同一知識の問題はありません")}</Section>
        <Section title={`同じ題材（${sameTopic.length}）`}>{list(sameTopic, "同じ題材の問題はありません")}</Section>
      </div>
    </div>
  )
}

function HistoryTab({ q, postJobs }: { q: Question; postJobs: PostJob[] }) {
  const jobs = postJobs.filter((j) => j.questionId === q.id).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
  if (jobs.length === 0) return <Section title="出題履歴"><Empty>まだ投稿されていません</Empty></Section>
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>媒体</TableHead>
            <TableHead>予約日時</TableHead>
            <TableHead>公開日時</TableHead>
            <TableHead>版</TableHead>
            <TableHead>投稿ID</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell>
                <PlatformMark platform={j.platform} />
              </TableCell>
              <TableCell className="tabular-nums">{formatDateTime(j.scheduledAt)}</TableCell>
              <TableCell className="tabular-nums">{j.publishedAt ? formatDateTime(j.publishedAt) : "—"}</TableCell>
              <TableCell className="font-mono text-xs">v{j.questionVersion}</TableCell>
              <TableCell className="font-mono text-xs">{j.externalId ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <StatusBadge {...POST_STATUS[j.status]} />
                  {j.error && <span className="text-xs text-destructive">{j.error}</span>}
                </div>
              </TableCell>
              <TableCell>
                {j.url ? (
                  <a href={j.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                    開く
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">（{PLATFORM_LABEL[j.platform]}の投稿）</span>
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ResultsTab({ q }: { q: Question }) {
  const total = responseStats(q)
  if (q.responses.length === 0) return <Section title="回答実績"><Empty>回答データはまだありません</Empty></Section>
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card">
        {[
          { label: "総回答数", value: formatCount(total.responses) },
          { label: "正答数", value: formatCount(total.correct) },
          { label: "正答率", value: formatPercent(total.correct, total.responses) },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {q.responses.map((r) => {
          const max = Math.max(1, ...Object.values(r.perChoice).map((v) => v ?? 0))
          return (
            <Card key={r.postJobId}>
              <CardHeader className="flex flex-row items-center gap-2">
                <PlatformMark platform={r.platform} />
                <CardTitle className="text-sm">{PLATFORM_LABEL[r.platform]}</CardTitle>
                <StatusBadge label={r.finalized ? "確定" : "集計中"} tone={r.finalized ? "success" : "info"} className="ml-auto" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2" aria-label="選択肢別回答数">
                  {q.choices.map((c) => {
                    const v = r.perChoice[c.label]
                    const correct = c.label === q.answer
                    return (
                      <li key={c.label} className="grid grid-cols-[1.5rem_1fr_3.5rem] items-center gap-2 text-sm">
                        <span className={cn("font-mono font-semibold", correct && "text-success")}>{c.label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", correct ? "bg-success" : "bg-muted-foreground/50")}
                            style={{ width: `${((v ?? 0) / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-right tabular-nums">{formatCount(v)}</span>
                      </li>
                    )
                  })}
                </ul>
                <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                  <Metric label="回答数" value={formatCount(r.responses)} />
                  <Metric label="正答率" value={formatPercent(r.correct, r.responses)} />
                  <Metric label="表示数" value={formatCount(r.impressions)} />
                  <Metric label="クリック" value={formatCount(r.clicks)} />
                  {r.platform === "discord" && (
                    <>
                      <Metric label="リアクション" value={formatCount(r.reactionEvents ?? null)} />
                      <Metric label="有効回答者" value={formatCount(r.uniqueVoters ?? null)} />
                      {r.invalidVoters != null && <Metric label="無効（複数選択）" value={formatCount(r.invalidVoters)} />}
                    </>
                  )}
                </dl>
                <p className="text-xs text-muted-foreground tabular-nums">
                  取得 {r.collectedAt ? formatDateTime(r.collectedAt) : "未取得"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function VersionsTab({ q }: { q: Question }) {
  const versions = [...q.versions].sort((a, b) => b.version - a.version)
  if (versions.length === 0) return <Section title="バージョン履歴"><Empty>履歴がありません</Empty></Section>
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((v, i) => {
        const prev = versions[i + 1]
        const changed = (field: "text" | "explanation" | "answer") => prev && prev.snapshot[field] !== v.snapshot[field]
        const choicesChanged = prev && JSON.stringify(prev.snapshot.choices) !== JSON.stringify(v.snapshot.choices)
        return (
          <li key={v.version}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                <CardTitle className="font-mono text-sm">v{v.version}</CardTitle>
                {q.confirmedVersion === v.version && <StatusBadge label="確定版" tone="success" />}
                <span className="text-sm">{v.summary}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {v.author} ・ {formatDateTime(v.createdAt)}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Diff label="問題文" changed={changed("text")} before={prev?.snapshot.text} after={v.snapshot.text} />
                <Diff
                  label="選択肢"
                  changed={choicesChanged}
                  before={prev?.snapshot.choices.map((c) => `${c.label}. ${c.text}`).join(" / ")}
                  after={v.snapshot.choices.map((c) => `${c.label}. ${c.text}`).join(" / ")}
                />
                <Diff label="正解" changed={changed("answer")} before={prev?.snapshot.answer} after={v.snapshot.answer} />
                <Diff label="解説" changed={changed("explanation")} before={prev?.snapshot.explanation} after={v.snapshot.explanation} />
                <p className="font-mono text-xs text-muted-foreground">hash {v.hash}</p>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

function Diff({ label, changed, before, after }: { label: string; changed?: boolean; before?: string; after: string }) {
  return (
    <div className="grid grid-cols-[4rem_1fr] gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {changed ? (
        <div className="flex flex-col gap-1">
          <del className="rounded bg-destructive/10 px-2 py-1 text-muted-foreground">{before}</del>
          <ins className="rounded bg-success/10 px-2 py-1 no-underline">{after}</ins>
        </div>
      ) : (
        <span className="leading-relaxed text-muted-foreground">{after}</span>
      )}
    </div>
  )
}
