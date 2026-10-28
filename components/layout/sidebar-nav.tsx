"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useQuiz } from "@/lib/store/quiz-store"
import { NAV_ITEMS } from "./nav-items"

/** onLight：明るい背景（ログイン画面など）で使うとき。既定はサイドバーの暗い背景用の色 */
export function BrandMark({ onLight = false }: { onLight?: boolean }) {
  const { state } = useQuiz()
  const { brand } = state.settings
  return (
    <div className="flex items-center gap-2.5">
      {brand.logoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoDataUrl} alt={`${brand.name} ロゴ`} className="size-8 rounded-md object-contain" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground" aria-hidden>
          {brand.logoText}
        </span>
      )}
      <div className="flex flex-col leading-tight">
        <span className={cn("text-sm font-semibold", onLight ? "text-foreground" : "text-sidebar-accent-foreground")}>{brand.name}</span>
        <span className={cn("text-[11px] tracking-wide", onLight ? "text-muted-foreground" : "text-sidebar-foreground/70")}>Quiz Manager</span>
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data } = useQuiz()
  const reviewCount = data.questions.filter((q) => q.status === "review" || q.status === "returned").length
  const issueCount = data.postJobs.filter((j) => j.status === "failed" || j.status === "unknown").length

  return (
    <nav aria-label="メインナビゲーション" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        const badge = item.href === "/reviews" ? reviewCount : item.href === "/posts" ? issueCount : 0
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/70")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {badge > 0 && (
              <span className={cn("min-w-5 rounded px-1.5 text-center font-mono text-[11px] leading-5", item.href === "/posts" ? "bg-destructive/20 text-destructive" : "bg-sidebar-primary/20 text-sidebar-primary")}>
                {badge}
                <span className="sr-only">件</span>
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
