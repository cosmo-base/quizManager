"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BrandMark, SidebarNav } from "./sidebar-nav"
import { AppHeader } from "./app-header"
import { ModeBanner } from "./mode-banner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <BrandMark />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/60">Cosmo Base 社内運用ツール</p>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-6 border-sidebar-border bg-sidebar p-4">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">メニュー</SheetTitle>
            <BrandMark />
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          menuButton={
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="メニューを開く">
              <Menu className="size-5" aria-hidden />
            </Button>
          }
        />
        <ModeBanner />
        <main className="flex flex-1 flex-col px-4 py-6 md:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
