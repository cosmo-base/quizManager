"use client"

import Link from "next/link"
import { Bell, CircleAlert, CircleCheck, CircleX, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useQuiz } from "@/lib/store/quiz-store"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AppNotification } from "@/lib/types"

const LEVEL_ICON: Record<AppNotification["level"], { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  error: { icon: CircleX, className: "text-destructive" },
  warning: { icon: CircleAlert, className: "text-warning" },
  info: { icon: Info, className: "text-primary" },
  success: { icon: CircleCheck, className: "text-success" },
}

export function NotificationsPopover() {
  const { data, actions } = useQuiz()
  const unread = data.notifications.filter((n) => !n.read).length

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`通知（未読${unread}件）`} />}>
        <Bell className="size-4" aria-hidden />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">通知</p>
          <Button variant="ghost" size="sm" onClick={actions.markAllNotificationsRead} disabled={unread === 0}>
            すべて既読
          </Button>
        </div>
        <ul className="flex max-h-96 flex-col overflow-y-auto">
          {data.notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">通知はありません</li>}
          {data.notifications.map((n) => {
            const { icon: Icon, className } = LEVEL_ICON[n.level]
            return (
              <li key={n.id} className="border-b last:border-b-0">
                <Link href={n.href} onClick={() => actions.markNotificationRead(n.id)} className={cn("flex gap-3 px-4 py-3 hover:bg-muted", !n.read && "bg-primary/5")}>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("text-sm", !n.read && "font-medium")}>{n.title}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{n.description}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="sr-only">未読</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
