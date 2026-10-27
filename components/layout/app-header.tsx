"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { LogOut, Moon, Sun, Pause, Play, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
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

function AutomationPill() {
  const { state, actions, can } = useQuiz()
  const { automationPaused, emergencyStop } = state.settings
  const running = !automationPaused && !emergencyStop
  const label = emergencyStop ? "緊急停止中" : running ? "自動処理：稼働中" : "自動処理：停止中"
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={actions.toggleAutomation}
      disabled={emergencyStop || !can("automation")}
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
