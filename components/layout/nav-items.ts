import { BarChart3, CalendarDays, ClipboardCheck, Home, Library, Send, Settings, Sparkles, BrainCircuit } from "lucide-react"

export const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/calendar", label: "出題計画", icon: CalendarDays },
  { href: "/generate", label: "AI問題生成", icon: Sparkles },
  { href: "/questions", label: "問題ライブラリ", icon: Library },
  { href: "/reviews", label: "確認・承認", icon: ClipboardCheck },
  { href: "/posts", label: "投稿管理", icon: Send },
  { href: "/analytics", label: "AI定性分析", icon: BrainCircuit },
  { href: "/kpi", label: "KPIダッシュボード", icon: BarChart3 },
  { href: "/settings", label: "設定", icon: Settings },
] as const

export function titleForPath(pathname: string) {
  if (pathname.startsWith("/questions/")) return "問題詳細"
  const item = NAV_ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
  return item?.label ?? "Cosmo Base Quiz Manager"
}
