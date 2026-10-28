"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { LogOut, Moon, Sun, Pause, Play, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGoogleAuth } from "@/lib/auth/google-auth"
import { useQuiz } from "@/lib/store/quiz-store"
import { ROLE_LABEL } from "@/lib/constants"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"
import { titleForPath } from "./nav-items"
import { GlobalSearch } from "./global-search"
import { NotificationsPopover } from "./notifications-popover"

/** 実APIモード：GAS の AUTOMATION_ENABLED を表示し、確認のうえ切り替える */
function LiveAutomationPill() {
  const { state, actions, can } = useQuiz()
  const [confirming, setConfirming] = useState(false)
  const automation = state.liveStatus.automation
  const enabled = automation?.enabled ?? null
  const label = enabled === null ? "自動投稿：未取得" : enabled ? "自動投稿：稼働中" : "自動投稿：停止中"
  // 媒体ごとのドライラン（Discord は Bot が設定済みのときだけ対象）
  const modes = automation ? [{ name: "X", dry: automation.dryRun }, ...(automation.discord ? [{ name: "Discord", dry: automation.discord.dryRun }] : [])] : []
  const allDry = modes.length > 0 && modes.every((m) => m.dry)
  const modeText = modes.map((m) => `${m.name} は${m.dry ? "ドライランのため投稿しません" : "本番投稿モードのため実際に投稿されます"}`).join("。")
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={enabled === null || !can("automation")}
        className="hidden gap-2 md:inline-flex"
        aria-label={`${label}（クリックで${enabled ? "停止" : "再開"}）`}
      >
        <span className={cn("size-2 rounded-full", enabled === null ? "bg-muted-foreground" : enabled ? "bg-success" : "bg-warning")} aria-hidden />
        {label}
        {allDry && <span className="rounded bg-info/15 px-1 text-[11px] text-info">ドライラン</span>}
        {enabled ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
      </Button>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{enabled ? "毎朝の自動投稿を停止しますか？" : "毎朝の自動投稿を再開しますか？"}</DialogTitle>
            <DialogDescription>
              {enabled
                ? "06:00 の投稿・正解発表、前日 18:00 の確認依頼と 21:00 の確定が止まります。管理画面からの手動投稿はできます。"
                : `06:00 に前日の正解発表と当日の問題の投稿を自動で行います。現在、${modeText}。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              戻る
            </Button>
            <Button
              variant={enabled ? "destructive" : "default"}
              onClick={() => {
                setConfirming(false)
                void actions.setLiveAutomation(!enabled)
              }}
            >
              {enabled ? "停止する" : "再開する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AutomationPill() {
  const { state, actions, can } = useQuiz()
  const { automationPaused, emergencyStop } = state.settings
  if (state.settings.dataMode === "live") return <LiveAutomationPill />
  return <DemoAutomationPill paused={automationPaused} emergencyStop={emergencyStop} onToggle={actions.toggleAutomation} allowed={can("automation")} />
}

function DemoAutomationPill({ paused: automationPaused, emergencyStop, onToggle, allowed }: { paused: boolean; emergencyStop: boolean; onToggle: () => void; allowed: boolean }) {
  const running = !automationPaused && !emergencyStop
  const label = emergencyStop ? "緊急停止中" : running ? "自動処理：稼働中" : "自動処理：停止中"
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      disabled={emergencyStop || !allowed}
      className="hidden gap-2 md:inline-flex"
      aria-label={`${label}（クリックで${running ? "一時停止" : "再開"}）`}
    >
      <span className={cn("size-2 rounded-full", running ? "bg-success" : emergencyStop ? "bg-destructive" : "bg-warning")} aria-hidden />
      {label}
      {running ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
    </Button>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="表示テーマを切り替え">
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
    </Button>
  )
}

/** Google のログインボタン（クライアント ID 未設定、またはログイン済みなら出さない） */
function GoogleSignIn() {
  const { configured, email, buttonRef } = useGoogleAuth()
  if (!configured || email) return null
  return <div ref={buttonRef} className="hidden sm:block" aria-label="Google でログイン" />
}

function UserMenu() {
  const { state, actions } = useQuiz()
  const auth = useGoogleAuth()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
        <UserRound className="size-4" aria-hidden />
        <span className="hidden text-sm sm:inline">{state.userName}</span>
        <span className="rounded bg-secondary px-1.5 text-[11px] text-secondary-foreground">{ROLE_LABEL[state.role]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {auth.email && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate text-xs font-normal">{auth.email}</DropdownMenuLabel>
              <DropdownMenuItem onClick={auth.signOut}>
                <LogOut aria-hidden />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuLabel>表示権限の切替（デモ）</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={state.role} onValueChange={(v) => actions.setRole(v as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Base UI の Label は Group の内側でないとエラーになる */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal leading-relaxed text-muted-foreground">本番ではGoogleログインのユーザー権限が適用されます</DropdownMenuLabel>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader({ menuButton }: { menuButton: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur md:px-8">
      {menuButton}
      <p className="truncate text-sm font-medium md:text-base">{titleForPath(pathname)}</p>
      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        <AutomationPill />
        <NotificationsPopover />
        <ThemeToggle />
        <GoogleSignIn />
        <UserMenu />
      </div>
    </header>
  )
}
