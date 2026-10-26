"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/** 重要な操作は実行前に対象を明示する */
export function ConfirmDialog({
  trigger,
  title,
  description,
  target,
  confirmLabel = "実行する",
  destructive,
  onConfirm,
  children,
}: {
  trigger: React.ReactElement
  title: string
  description?: string
  target?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  children?: React.ReactNode
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {target && <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm leading-relaxed">{target}</div>}
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
