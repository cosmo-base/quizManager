"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import type { ChoiceLabel, Platform } from "@/lib/types"
import { useQuiz, useCategoryName, useToday } from "@/lib/store/quiz-store"
import { DIFFICULTY_LABEL, PLATFORM_LABEL } from "@/lib/constants"
import { addDays, formatCount, formatDate, formatPercent } from "@/lib/format"
import { questionHref } from "@/lib/routes"
import { SimpleSelect } from "@/components/shared/simple-select"
import { PageHeader } from "@/components/shared/page-header"
import { LiveEmptyState, SampleTag } from "@/components/shared/states"
import { StatusBadge } from "@/components/shared/status-badge"
import { SimpleBarChart } from "@/components/kpi/kpi-charts"

type Agg = { posts: number; responses: number; correct: number; rated: number }
const empty = (): Agg => ({ posts: 0, responses: 0, correct: 0, rated: 0 })
const rate = (a: Agg) => (a.rated > 0 ? Math.round((a.correct / a.rated) * 1000) / 10 : 0)

const METRICS: { name: string; where: "here" | "dashboard" | "missing"; note: string }[] = [
  { name: "累計回答数・問題数・正答率", where: "here", note: "本画面で表示" },
  { name: "媒体別・分類別実績", where: "here", note: "本画面で表示" },
  { name: "正解位置の偏り", where: "here", note: "本画面で表示" },
  { name: "時系列推移", where: "dashboard", note: "既存ダッシュボードで表示" },
  { name: "回答数と難易度・文字数の関係", where: "dashboard", note: "既存ダッシュボードで表示" },
  { name: "投稿時刻別の反応", where: "dashboard", note: "既存ダッシュボードで表示" },
  { name: "表示数・回答率", where: "missing", note: "X APIの表示数取得は技術検証中。追加計測が必要" },
  { name: "CB流入・転換率", where: "missing", note: "UTM付きリンクとCB側の計測タグ追加が必要" },
]

type Period = "7" | "30" | "90" | "all"
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7", label: "直近7日" },
  { value: "30", label: "直近30日" },
  { value: "90", label: "直近90日" },
  { value: "all", label: "すべて" },
]

export default function KpiPage() {
  const { data, state } = useQuiz()
  const categoryName = useCategoryName()
  const today = useToday()
  const isLive = state.settings.dataMode === "live"
  // 実APIモード：分類・難易度は正本に無いので、期間で絞り、問題ごとの結果を出す
  const [period, setPeriod] = useState<Period>("30")
  const since = period === "all" ? null : addDays(today, -Number(period) + 1)
  const jobDate = useMemo(() => new Map(data.postJobs.map((j) => [j.id, j.date])), [data.postJobs])
  const inPeriod = (postJobId: string) => {
    if (!isLive || !since) return true
    const d = jobDate.get(postJobId)
    return !!d && d >= since && d <= today
  }
  const platforms: Platform[] = isLive ? (state.liveStatus.discordConfigured ? ["x", "discord"] : ["x"]) : ["x", "discord", "instagram"]

  const kpi = useMemo(() => {
    const total = empty()
    const byPlatform: Record<Platform, Agg> = { x: empty(), discord: empty(), instagram: empty() }
    const byCategory = new Map<string, Agg>()
    const byDifficulty = new Map<string, { posts: number; responses: number }>()
    const positions: Record<ChoiceLabel, number> = { A: 0, B: 0, C: 0 }

    for (const q of data.questions) {
      const responses = q.responses.filter((r) => inPeriod(r.postJobId))
      if (!responses.length) continue
      positions[q.answer] += 1
      const cat = byCategory.get(q.categoryId) ?? empty()
      const diff = byDifficulty.get(q.difficulty) ?? { posts: 0, responses: 0 }
      for (const r of responses) {
        const targets = [total, byPlatform[r.platform], cat]
        for (const t of targets) {
          t.posts += 1
          t.responses += r.responses ?? 0
          if (r.responses != null && r.correct != null) {
            t.correct += r.correct
            t.rated += r.responses
          }
        }
        diff.posts += 1
        diff.responses += r.responses ?? 0
      }
      byCategory.set(q.categoryId, cat)
      byDifficulty.set(q.difficulty, diff)
    }
    return { total, byPlatform, byCategory, byDifficulty, positions }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.questions, since, today, jobDate, isLive])

  /** 問題ごとの結果（新しい順）。実APIモードで使う */
  const rows = useMemo(
    () =>
      data.questions
        .flatMap((q) => q.responses.filter((r) => inPeriod(r.postJobId)).map((r) => ({ q, r, date: jobDate.get(r.postJobId) ?? "" })))
        .sort((a, b) => b.date.localeCompare(a.date) || a.r.platform.localeCompare(b.r.platform)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.questions, since, today, jobDate, isLive],
  )
  const positionTotal = kpi.positions.A + kpi.positions.B + kpi.positions.C

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="KPIダッシュボード"
        description="運営に必要な基本指標のみを表示します。詳細な分析は既存のKPIダッシュボードで行います。"
        actions={
          <a
            href={state.settings.kpiDashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            既存ダッシュボードを開く
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />

      {isLive && (
        <div className="flex items-center gap-2">
          <SimpleSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} aria-label="期間" className="w-36" />
          <span className="text-xs text-muted-foreground">出題日で絞り込みます（回答結果は正本の Sheets の記録）</span>
        </div>
      )}

      {isLive && kpi.total.posts === 0 ? (
        <LiveEmptyState what="回答実績" description={period === "all" ? "まだ回答結果がありません。投稿管理で「結果を取得」するか、毎朝の自動処理で集計されると表示されます。" : "この期間の回答結果はありません。期間を広げてください。"} />
      ) : (
        <>
          <section aria-label="主要指標" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "累計回答数", value: formatCount(kpi.total.responses), sub: "確定値＋暫定値" },
              { label: "出題数", value: formatCount(kpi.total.posts), sub: "媒体ごとの投稿件数" },
              { label: "平均正答率", value: `${rate(kpi.total)}%`, sub: "回答数が取得できた投稿のみ" },
              { label: "1投稿あたり回答数", value: kpi.total.posts ? formatCount(Math.round(kpi.total.responses / kpi.total.posts)) : "—", sub: "全媒体平均" },
            ].map((m) => (
              <div key={m.label} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <span className="font-mono text-2xl font-semibold tabular-nums">{m.value}</span>
                <span className="text-xs text-muted-foreground">{m.sub}</span>
              </div>
            ))}
          </section>

          {!isLive && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <SampleTag />
              表示中の値はサンプルデータから算出しています。
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-labelledby="by-platform" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 id="by-platform" className="text-sm font-semibold">
                媒体別の回答数
              </h2>
              <SimpleBarChart
                label="回答数"
                data={platforms.map((p) => ({ name: PLATFORM_LABEL[p], value: kpi.byPlatform[p].responses }))}
              />
              <dl className="grid grid-cols-3 gap-2 text-xs">
                {platforms.map((p) => (
                  <div key={p} className="flex flex-col gap-0.5 rounded-lg bg-secondary/60 p-2">
                    <dt className="text-muted-foreground">{PLATFORM_LABEL[p]}</dt>
                    <dd>
                      <span className="font-mono">{kpi.byPlatform[p].posts}</span>件・正答率<span className="font-mono">{rate(kpi.byPlatform[p])}%</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {!isLive && (
            <section aria-labelledby="by-category" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 id="by-category" className="text-sm font-semibold">
                分類別の正答率
              </h2>
              <SimpleBarChart
                label="正答率"
                unit="%"
                color="var(--chart-2)"
                data={[...kpi.byCategory.entries()].map(([id, a]) => ({ name: categoryName(id), value: rate(a) }))}
              />
            </section>
            )}
            {!isLive && (

            <section aria-labelledby="by-difficulty" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 id="by-difficulty" className="text-sm font-semibold">
                難易度別の平均回答数
              </h2>
              <SimpleBarChart
                label="平均回答数"
                color="var(--chart-3)"
                data={(["beginner", "intermediate", "advanced"] as const).map((d) => {
                  const a = kpi.byDifficulty.get(d)
                  return { name: DIFFICULTY_LABEL[d], value: a && a.posts ? Math.round(a.responses / a.posts) : 0 }
                })}
              />
            </section>
            )}

            <section aria-labelledby="by-position" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 id="by-position" className="text-sm font-semibold">
                正解位置の分布
              </h2>
              <div className="flex flex-col gap-3">
                {(["A", "B", "C"] as ChoiceLabel[]).map((l) => {
                  const pct = positionTotal ? Math.round((kpi.positions[l] / positionTotal) * 100) : 0
                  return (
                    <div key={l} className="flex items-center gap-3">
                      <span className="w-4 font-mono text-sm font-semibold">{l}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary" role="presentation">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                        {kpi.positions[l]}問・{pct}%
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                理想は各33%前後です。偏りがある場合は 設定 &gt; 問題生成ルール の「正解位置の偏り抑制」を確認してください。
              </p>
            </section>
          </div>

          {isLive && (
            <section aria-labelledby="by-question" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <h2 id="by-question" className="text-sm font-semibold">
                問題ごとの結果
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 font-normal">出題日</th>
                      <th className="py-2 font-normal">媒体</th>
                      <th className="py-2 font-normal">問題</th>
                      <th className="py-2 text-right font-normal">回答数</th>
                      <th className="py-2 text-right font-normal">正答率</th>
                      <th className="py-2 text-right font-normal">選択肢 1／2／3</th>
                      <th className="py-2 text-right font-normal">集計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ q, r, date }) => (
                      <tr key={r.postJobId} className="border-b last:border-0">
                        <td className="py-2 whitespace-nowrap tabular-nums">{date ? formatDate(date) : "—"}</td>
                        <td className="py-2">{PLATFORM_LABEL[r.platform]}</td>
                        <td className="max-w-80 py-2">
                          <Link href={questionHref(q.id)} className="line-clamp-1 hover:underline">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{q.id}</span>
                            {q.text}
                          </Link>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{formatCount(r.responses)}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{formatPercent(r.correct, r.responses)}</td>
                        <td className="py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                          {(["A", "B", "C"] as ChoiceLabel[]).map((l) => (
                            <span key={l} className={l === q.answer ? "font-semibold text-success" : undefined}>
                              {r.perChoice[l] ?? "—"}
                              {l !== "C" && "／"}
                            </span>
                          ))}
                        </td>
                        <td className="py-2 text-right">
                          <StatusBadge tone={r.finalized ? "success" : "info"} label={r.finalized ? "確定" : "暫定"} hideIcon />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">正解の選択肢の票を緑で示します。X の表示回数・クリック数は取得していません。</p>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="metric-coverage" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 id="metric-coverage" className="text-sm font-semibold">
          指標の取得状況
        </h2>
        <ul className="divide-y divide-border">
          {METRICS.map((m) => (
            <li key={m.name} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{m.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{m.note}</span>
                <StatusBadge
                  tone={m.where === "here" ? "success" : m.where === "dashboard" ? "info" : "warning"}
                  label={m.where === "here" ? "表示中" : m.where === "dashboard" ? "既存DB" : "要追加計測"}
                  hideIcon={m.where === "dashboard"}
                />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
