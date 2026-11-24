"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ExternalLink, Globe } from "lucide-react"
import { useQuiz } from "@/lib/store/quiz-store"
import { ARCHIVE_SITE_URL } from "@/lib/archive"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState, PermissionNote } from "@/components/shared/states"
import { ArchiveQuestionsTab } from "@/components/archive/questions-tab"
import { ArchiveReportsTab } from "@/components/archive/reports-tab"
import { ArchiveSimilarTab } from "@/components/archive/similar-tab"
import { ArchiveNoticesTab } from "@/components/archive/notices-tab"
import type { ArchiveSaveNoticeInput } from "@/lib/services/gas-contract"

const TABS = [
  { value: "questions", label: "問題" },
  { value: "similar", label: "似た問題" },
  { value: "reports", label: "誤り報告" },
  { value: "notices", label: "お知らせ" },
] as const
type TabValue = (typeof TABS)[number]["value"]

function ArchiveContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { state, can } = useQuiz()
  const live = state.settings.dataMode === "live"
  const initialTab = TABS.some((t) => t.value === params.get("tab")) ? (params.get("tab") as TabValue) : "questions"
  const [tab, setTab] = useState<TabValue>(initialTab)
  const [openId, setOpenId] = useState<string | null>(params.get("id"))
  // 問題の画面から「訂正のお知らせを作る」を押したときの下書き
  const [noticeDraft, setNoticeDraft] = useState<ArchiveSaveNoticeInput | null>(null)
  const canEdit = can("approve")

  const openQuestion = (id: string | null) => {
    setOpenId(id)
    if (id) setTab("questions")
    router.replace(id ? `/archive?tab=questions&id=${encodeURIComponent(id)}` : `/archive?tab=${tab}`)
  }

  if (!live) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="過去問サイト" />
        <EmptyState icon={Globe} title="実APIモードでのみ使えます" description="過去問サイトの管理は本番のデータだけを扱います。設定から実APIモードに切り替えてください。" />
      </div>
    )
  }
  if (!state.liveStatus.me) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="過去問サイト" />
        <EmptyState icon={Globe} title="Google でログインしてください" description="ログインすると、過去問サイトの問題・誤り報告・お知らせを読み込みます。" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="過去問サイト"
        description="出題済みの問題（過去問サイトに公開しているもの）の修正、参加者からの誤り報告、サイトのお知らせを管理します。保存するとすぐサイトに反映されます。"
        actions={
          <a href={ARCHIVE_SITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            サイトを開く
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
      />
      {!canEdit && <PermissionNote role={state.role} need="過去問サイトの内容を変更" />}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabValue)
          router.replace(`/archive?tab=${v}`)
        }}
        className="flex flex-col gap-6"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="questions">
          <ArchiveQuestionsTab
            canEdit={canEdit}
            openId={openId}
            onOpen={openQuestion}
            onDraftNotice={(draft) => {
              setNoticeDraft(draft)
              setOpenId(null)
              setTab("notices")
              router.replace("/archive?tab=notices")
            }}
          />
        </TabsContent>
        <TabsContent value="similar">
          <ArchiveSimilarTab canEdit={canEdit} onOpenQuestion={openQuestion} />
        </TabsContent>
        <TabsContent value="reports">
          <ArchiveReportsTab canEdit={canEdit} onOpenQuestion={openQuestion} />
        </TabsContent>
        <TabsContent value="notices">
          <ArchiveNoticesTab canEdit={canEdit} draft={noticeDraft} onDraftUsed={() => setNoticeDraft(null)} onOpenQuestion={openQuestion} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function ArchivePage() {
  return (
    <Suspense fallback={null}>
      <ArchiveContent />
    </Suspense>
  )
}
