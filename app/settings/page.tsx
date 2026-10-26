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

const TABS = [
  { value: "ai", label: "AI設定" },
  { value: "posting", label: "投稿設定" },
  { value: "rules", label: "問題生成ルール" },
  { value: "data", label: "Sheets・DB" },
  { value: "users", label: "ユーザー・権限" },
  { value: "notifications", label: "通知" },
] as const

function SettingsContent() {
  const params = useSearchParams()
  const initial = TABS.some((t) => t.value === params.get("tab")) ? (params.get("tab") as string) : "ai"
  const [tab, setTab] = useState(initial)
  const { state, can } = useQuiz()
  const disabled = !can("settings")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="設定" description="AI・投稿・生成ルール・データ連携・権限・通知を管理します。変更は即時に反映されます。" />
      {disabled && <PermissionNote role={state.role} need="設定を変更" />}

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex flex-col gap-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
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
