"use client"

// 実APIモード：ユーザーと権限（GAS の user_roles タブ）。
// 管理者は申請の承認・却下と権限の変更ができる。ほかの人は自分の権限を確認し、申請できる。
import { useCallback, useEffect, useState } from "react"
import { Check, KeyRound, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SimpleSelect } from "@/components/shared/simple-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { RoleRequestDialog } from "@/components/shared/role-request-dialog"
import { SettingsCard } from "@/components/settings/fields"
import { ROLE_LABEL } from "@/lib/constants"
import { formatDateTime } from "@/lib/format"
import type { GasUser } from "@/lib/services/gas-contract"
import { useQuiz } from "@/lib/store/quiz-store"
import type { Role } from "@/lib/types"

const ROLE_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))
const ROLE_SUMMARY = "管理者：全操作・ユーザー管理／編集者：作成・編集・AI生成／承認者：承認・投稿／閲覧者：閲覧のみ"

export function LiveUsersPanel() {
  const { state, actions, can } = useQuiz()
  const me = state.liveStatus.me
  const canManage = can("users")
  const [users, setUsers] = useState<GasUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  const load = useCallback(async () => {
    if (!canManage) return
    setUsers(await actions.loadLiveUsers())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (email: string, fn: () => Promise<boolean>) => {
    setBusy(email)
    const done = await fn()
    setBusy(null)
    if (done) void load()
  }

  const pending = (users ?? []).filter((u) => u.pendingRequest)

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-6">
        {canManage && (
          <SettingsCard title="権限の申請" description="承認すると、その権限がすぐに付きます。申請は Discord の運営用チャンネル（なければメール）にも届きます。">
            {users === null ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">申請はありません</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="権限の申請">
                {pending.map((u) => (
                  <li key={u.email} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {u.name || u.email}：{ROLE_LABEL[u.role]} → <strong>{ROLE_LABEL[u.pendingRequest!.role]}</strong>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                        {u.pendingRequest!.at && `・${formatDateTime(u.pendingRequest!.at)}`}
                      </span>
                      {u.pendingRequest!.note && <span className="text-xs">理由：{u.pendingRequest!.note}</span>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={busy === u.email} onClick={() => run(u.email, () => actions.setLiveUserRole(u.email, u.pendingRequest!.role))}>
                        <Check aria-hidden />
                        承認
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === u.email} onClick={() => run(u.email, () => actions.rejectLiveRoleRequest(u.email))}>
                        <X aria-hidden />
                        却下
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SettingsCard>
        )}

        <SettingsCard title="ユーザーと権限" description={ROLE_SUMMARY}>
          {!canManage ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                あなたの権限：<strong>{me ? ROLE_LABEL[me.role] : "—"}</strong>
                {me?.fixed && "（USER_ROLES で固定）"}
              </p>
              {me?.pendingRequest && <p className="text-sm text-muted-foreground">{ROLE_LABEL[me.pendingRequest.role]}を申請中です。管理者の承認をお待ちください。</p>}
              {me && !me.fixed && (
                <Button variant="outline" className="self-start" onClick={() => setRequesting(true)}>
                  <KeyRound aria-hidden />
                  権限を申請
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">ログインできる人は GAS のスクリプトプロパティ ALLOWED_EMAILS で決まります。USER_ROLES に書いた人の権限は固定です。</p>
                <Button size="sm" variant="ghost" onClick={() => void load()} aria-label="一覧を再読み込み">
                  <RefreshCw aria-hidden />
                </Button>
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border" aria-label="ユーザー一覧">
                {(users ?? []).map((u) => (
                  <li key={u.email} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {u.name || u.email}
                        {u.email === me?.email && <StatusBadge tone="info" label="あなた" />}
                        {u.fixed && <StatusBadge tone="muted" label="固定" />}
                        {!u.allowed && <StatusBadge tone="warning" label="ログイン不可" />}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                        {u.lastSeenAt ? `・初回ログイン ${formatDateTime(u.lastSeenAt)}` : "・まだログインしていません"}
                      </span>
                    </div>
                    <SimpleSelect<Role>
                      aria-label={`${u.name || u.email}の権限`}
                      size="sm"
                      className="w-32"
                      disabled={u.fixed || !u.allowed || u.email === me?.email || busy === u.email}
                      value={u.role}
                      onChange={(r) => run(u.email, () => actions.setLiveUserRole(u.email, r))}
                      options={ROLE_OPTIONS}
                    />
                  </li>
                ))}
                {users !== null && users.length === 0 && <li className="p-3 text-sm text-muted-foreground">ユーザーがいません</li>}
              </ul>
            </>
          )}
        </SettingsCard>
      </div>
      {me && <RoleRequestDialog open={requesting} onOpenChange={setRequesting} />}
    </div>
  )
}
