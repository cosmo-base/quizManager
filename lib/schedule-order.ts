// 画面の標準の並び：今日 → 先の日（近い順）→ 日付なし → 昨日 → それより前（新しい順）。
// 問題ライブラリ・投稿管理で共通に使う。同じ順位のときは 0 を返す（呼ぶ側で ID・媒体などで並べる）
export function compareSchedule(a: string | null | undefined, b: string | null | undefined, today: string): number {
  const group = (d: string | null | undefined) => (!d ? 1 : d >= today ? 0 : 2)
  const ga = group(a)
  const gb = group(b)
  if (ga !== gb) return ga - gb
  if (ga === 1 || a === b) return 0
  return (ga === 0 ? a! < b! : a! > b!) ? -1 : 1
}
