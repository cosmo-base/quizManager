"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, RefreshCw, RotateCcw, Upload } from "lucide-react"
import type { AppNotification, DataMode, Role } from "@/lib/types"
import { useQuiz } from "@/lib/store/quiz-store"
import { ROLE_LABEL } from "@/lib/constants"
import { formatDateTime, formatRelative } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SimpleSelect } from "@/components/shared/simple-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { PermissionNote } from "@/components/shared/states"
import { Field, IntegrationList, SettingsCard, SwitchRow } from "@/components/settings/fields"

export function DataSettingsTab({ disabled }: { disabled: boolean }) {
  const { state, data, actions } = useQuiz()
  const sh = state.settings.sheets
  const set = actions.updateSettings
  const [confirmReset, setConfirmReset] = useState(false)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ questions: data.questions, slots: data.slots, postJobs: data.postJobs }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `quiz-manager-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <SettingsCard title="データモード" description="デモモードではサンプルデータと擬似処理のみを使い、外部APIは呼び出しません。">
        <Field id="data-mode" label="表示するデータ">
          <SimpleSelect<DataMode>
            id="data-mode"
            disabled={disabled}
            value={state.settings.dataMode}
            onChange={actions.setDataMode}
            options={[
              { value: "demo", label: "デモモード（サンプルデータ）" },
              { value: "live", label: "実APIモード（バックエンド接続）" },
            ]}
          />
        </Field>
        <IntegrationList keys={["supabase", "sheets", "storage"]} />
        <Button variant="outline" className="self-start" disabled={disabled} onClick={() => setConfirmReset(true)}>
          <RotateCcw aria-hidden />
          デモデータを初期化
        </Button>
      </SettingsCard>

      <SettingsCard title="Google Sheets同期" description="確定した回答集計を既存KPIダッシュボード用のシートへ書き込みます。">
        <Field id="sheet-name" label="スプレッドシート名">
          <Input id="sheet-name" value={sh.spreadsheetName} disabled={disabled} onChange={(e) => set((d) => void (d.sheets.spreadsheetName = e.target.value))} />
        </Field>
        <Field id="sheet-tab" label="書き込み先シート">
          <Input id="sheet-tab" value={sh.targetTab} disabled={disabled} onChange={(e) => set((d) => void (d.sheets.targetTab = e.target.value))} />
        </Field>
        <SwitchRow id="auto-sync" label="回答確定時に自動同期" checked={sh.autoSync} disabled={disabled} onChange={(v) => set((d) => void (d.sheets.autoSync = v))} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => actions.syncSheets()}>
            <RefreshCw aria-hidden />
            手動同期
          </Button>
          <Button variant="outline" onClick={exportJson}>
            <Download aria-hidden />
            エクスポート
          </Button>
          <Button variant="outline" disabled title="実APIモードで接続後に利用できます">
            <Upload aria-hidden />
            インポート
          </Button>
        </div>
      </SettingsCard>

      <div className="xl:col-span-2">
        <SettingsCard title="同期履歴">
          {data.syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">同期履歴はありません。</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.syncLogs.map((l) => (
                <li key={l.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{l.message}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(l.at)}・{l.target}・{l.rows}行
                    </span>
                  </div>
                  <StatusBadge tone={l.status === "synced" ? "success" : l.status === "failed" ? "danger" : "warning"} label={l.status === "synced" ? "同期済み" : l.status === "failed" ? "同期失敗" : "要確認"} />
                </li>
              ))}
            </ul>
          )}
        </SettingsCard>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>デモデータを初期化しますか？</DialogTitle>
            <DialogDescription>デモ中に行った編集・承認・投稿記録と設定がすべて初期状態に戻ります。実データには影響しません。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.resetDemo()
                setConfirmReset(false)
              }}
            >
              初期化する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))

export function UsersSettingsTab() {
  const { state, data, actions, can } = useQuiz()
  const canManage = can("users")

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <SettingsCard title="ユーザーと権限" description="管理者：全操作／編集者：生成・編集・計画／承認者：承認・投稿／閲覧者：閲覧のみ">
        {!canManage && <PermissionNote role={state.role} need="権限を変更" />}
        <Field id="demo-role" label="表示権限の切り替え（デモ確認用）" hint="各権限で画面がどう見えるかを確認できます">
          <SimpleSelect<Role> id="demo-role" value={state.role} onChange={actions.setRole} options={ROLE_OPTIONS} className="w-48" />
        </Field>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {data.users.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">
                  {u.email}・最終操作 {formatRelative(u.lastActiveAt)}
                </span>
              </div>
              <SimpleSelect<Role> aria-label={`${u.name}の権限`} size="sm" className="w-32" disabled={!canManage} value={u.role} onChange={(r) => actions.changeUserRole(u.id, r)} options={ROLE_OPTIONS} />
            </li>
          ))}
          {data.users.length === 0 && <li className="p-3 text-sm text-muted-foreground">ユーザー情報を取得できません。</li>}
        </ul>
      </SettingsCard>

      <SettingsCard title="操作履歴">
        <ul className="flex max-h-[28rem] flex-col divide-y divide-border overflow-y-auto">
          {data.activity.slice(0, 30).map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 py-2">
              <span className="text-sm">
                {a.href ? (
                  <Link href={a.href} className="underline-offset-4 hover:underline">
                    {a.action}
                  </Link>
                ) : (
                  a.action
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {a.actor}・{a.target}・{formatDateTime(a.at)}
              </span>
            </li>
          ))}
          {data.activity.length === 0 && <li className="py-2 text-sm text-muted-foreground">操作履歴はありません。</li>}
        </ul>
      </SettingsCard>
    </div>
  )
}

const NOTIFICATION_LABEL: Record<AppNotification["kind"], string> = {
  post_failed: "投稿失敗",
  aggregate_failed: "集計失敗",
  verify_error: "AI検証エラー",
  review_waiting: "承認待ち",
  ig_stock: "Instagramストック不足",
  budget: "API予算超過",
  sync_failed: "Sheets同期失敗",
  generation: "AI生成の完了",
}

export function NotificationSettingsTab({ disabled }: { disabled: boolean }) {
  const { state, actions } = useQuiz()
  const n = state.settings.notifications
  const kinds = Object.keys(NOTIFICATION_LABEL) as AppNotification["kind"][]

  return (
    <SettingsCard title="通知" description="アプリ内通知とメール通知を種類ごとに切り替えます。">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 font-medium">
              種類
            </th>
            <th scope="col" className="w-24 py-2 text-center font-medium">
              アプリ内
            </th>
            <th scope="col" className="w-24 py-2 text-center font-medium">
              メール
            </th>
          </tr>
        </thead>
        <tbody>
          {kinds.map((k) => (
            <tr key={k} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 text-left font-normal">
                {NOTIFICATION_LABEL[k]}
              </th>
              {(["inApp", "email"] as const).map((ch) => (
                <td key={ch} className="py-2.5 text-center">
                  <Switch
                    aria-label={`${NOTIFICATION_LABEL[k]}の${ch === "inApp" ? "アプリ内" : "メール"}通知`}
                    checked={n[k]?.[ch] ?? false}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      actions.updateSettings((d) => {
                        d.notifications[k] = { ...(d.notifications[k] ?? { inApp: false, email: false }), [ch]: Boolean(v) }
                      })
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsCard>
  )
}
