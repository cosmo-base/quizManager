// 問題文の近さ（文字の 2 文字ずつの並びの重なり）。Gemini は使わず、ブラウザの中だけで計算する。
// 言い回しを少し変えた問題や、同じことを問う問題を見つけるための目安で、完全ではない。
import { normalizeQuestionText } from "@/lib/question-validate"

/** これ以上なら「よく似た問題」として注意を出す */
export const SIMILAR_WARN = 0.6
/** これ以上なら「類似・関連問題」に並べる */
export const SIMILAR_LIST = 0.35

function bigrams(s: string): Set<string> {
  const t = normalizeQuestionText(s)
  const out = new Set<string>()
  if (t.length === 1) out.add(t)
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

/** 0〜1（1 は同じ文） */
export function textSimilarity(a: string, b: string): number {
  const x = bigrams(a)
  const y = bigrams(b)
  if (!x.size || !y.size) return 0
  let common = 0
  for (const g of x) if (y.has(g)) common++
  return (2 * common) / (x.size + y.size)
}

export interface SimilarHit<T> {
  item: T
  score: number
}

/** text に近いものを近い順に（自分自身は exclude で外す） */
export function findSimilar<T extends { id: string; text: string }>(text: string, items: T[], opts: { exclude?: string; min?: number; limit?: number } = {}): SimilarHit<T>[] {
  const min = opts.min ?? SIMILAR_LIST
  return items
    .filter((o) => o.id !== opts.exclude)
    .map((item) => ({ item, score: textSimilarity(text, item.text) }))
    .filter((h) => h.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 10)
}
