"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuiz } from "@/lib/store/quiz-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { PermissionNote } from "@/components/shared/states"
import { AiSettingsTab, PostingSettingsTab } from "@/components/settings/ai-posting-tabs"
import { RulesSettingsTab } from "@/components/settings/rules-tab"
import { DataSettingsTab, NotificationSettingsTab, UsersSettingsTab } from "@/components/settings/data-users-tabs"
import { LiveSystemSettings } from "@/components/settings/live-system"

const TABS = [
  { value: "ai", label: "AI設定" },
  { value: "posting", label: "投稿設定" },
  { value: "rules", label: "問題生成ルール" },
  { value: "data", label: "Sheets・DB" },
  { value: "users", label: "ユーザー・権限" },
  { value: "notifications", label: "通知" },
] as const

// 本番（実APIモード）：設定は GAS の値を読み取りで表示する。生成ルール・通知の詳細・画像テンプレートなどデモ用の設定は出さない
const LIVE_TABS = [
  { value: "system", label: "動作設定" },
  { value: "data", label: "Sheets・DB" },
  { value: "users", label: "ユーザー・権限" },
] as const

function SettingsContent() {
  const params = useSearchParams()
  const { state, can } = useQuiz()
  const live = state.settings.dataMode === "live"
  const tabs: readonly { value: string; label: string }[] = live ? LIVE_TABS : TABS
  const initial = tabs.some((t) => t.value === params.get("tab")) ? (params.get("tab") as string) : tabs[0].value
  const [tab, setTab] = useState(initial)
  const current = tabs.some((t) => t.value === tab) ? tab : tabs[0].value
  const disabled = !can("settings")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description={live ? "本番の動作設定（GAS の値）・データ連携・ユーザーと権限を確認します。" : "AI・投稿・生成ルール・データ連携・権限・通知を管理します。変更は即時に反映されます。"} />
      {disabled && !live && <PermissionNote role={state.role} need="設定を変更" />}

      <Tabs value={current} onValueChange={(v) => setTab(String(v))} className="flex flex-col gap-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="system">
          <LiveSystemSettings />
        </TabsContent>
        <TabsContent value="ai">
          <AiSettingsTab disabled={disabled} />
        </TabsContent>
        <TabsContent value="posting">
          <PostingSettingsTab disabled={disabled} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesSettingsTab disabled={disabled} />
        </TabsContent>
        <TabsContent value="data">
          <DataSettingsTab disabled={disabled} />
        </TabsContent>
        <TabsContent value="users">
          <UsersSettingsTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettingsTab disabled={disabled} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
