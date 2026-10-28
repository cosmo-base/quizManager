"use client"

import { questionHref } from "@/lib/routes"
import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Award,
  CalendarPlus,
  ChevronLeft,
  Copy,
  Download,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PlatformMark } from "@/components/shared/platform-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState, SampleTag } from "@/components/shared/states"
import { QuestionDetailTabs } from "@/components/questions/detail-tabs"
import { AssignToPlanDialog, EditQuestionDialog } from "@/components/questions/detail-dialogs"
import { LiveAssignDateDialog } from "@/components/questions/live-assign-dialog"
import { LiveReturnNotice, LiveSuggestion } from "@/components/questions/live-suggestion"
import { downloadCsv, questionsToCsv, reusableDate } from "@/components/questions/library-utils"
import { CERT_STATUS, DIFFICULTY_LABEL, FACTCHECK_STATUS, QUESTION_STATUS } from "@/lib/constants"
import { DEMO_TODAY, formatDate } from "@/lib/format"
import { useCategoryName, useQuiz } from "@/lib/store/quiz-store"
import { can } from "@/lib/validation"

type DialogKind = "edit" | "plan" | "reuse" | null

// 静的書き出しでは useSearchParams を Suspense で包む必要がある
export default function QuestionDetailPage() {
  return (
    <Suspense>
      <QuestionDetail />
    </Suspense>
  )
}

function QuestionDetail() {
  const id = useSearchParams().get("id") ?? ""
  const router = useRouter()
  const { state, data, actions } = useQuiz()
  const categoryName = useCategoryName()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [verifying, setVerifying] = useState(false)

  const q = data.questions.find((x) => x.id === id)
  if (!q) {
    return (
      <EmptyState
        title="問題が見つかりません"
        description={`問題ID「${id}」は存在しないか、削除されました`}
        action={
          <Link href="/questions" className={buttonVariants({ variant: "outline" })}>
            ライブラリへ戻る
          </Link>
        }
      />
    )
  }

  const role = state.role
  const canEdit = can(role, "edit")
  const canPlan = can(role, "plan")
  const canFix = canEdit || can(role, "approve")
  const reuseFrom = reusableDate(q, state.settings.rules)
  // 実APIモードで正本（GAS・Sheets）にまだつないでいない操作は押せないようにする
  const isLive = state.settings.dataMode === "live"
  // 実APIモードの再検証は Gemini のファクトチェック（GAS に GEMINI_API_KEY があるときだけ）
  const aiReady = !!state.liveStatus.ai?.configured

  const duplicate = async () => {
    const newId = await actions.duplicateQuestion(q.id)
    if (newId) router.push(questionHref(newId))
  }
  const reverify = async () => {
    setVerifying(true)
    try {
      await actions.reverify(q.id)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link href="/questions" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          問題ライブラリ
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformMark platform={q.platform} />
              <span className="font-mono text-sm text-muted-foreground">{q.id}</span>
              <StatusBadge {...QUESTION_STATUS[q.status]} />
              <StatusBadge {...FACTCHECK_STATUS[q.factCheck.status]} />
              {q.certification !== "none" && <StatusBadge {...CERT_STATUS[q.certification]} />}
              {q.isSample && <SampleTag />}
            </div>
            <h1 className="text-xl leading-snug font-semibold text-balance">{q.text}</h1>
            <p className="text-sm text-muted-foreground">
              {categoryName(q.categoryId)} ・ {q.difficulty === "auto" ? "難易度未設定" : DIFFICULTY_LABEL[q.difficulty]} ・ {q.plannedDate ? `出題日 ${formatDate(q.plannedDate)}` : "出題日未設定"}
              {!isLive && reuseFrom && ` ・ 再出題可能 ${reuseFrom}`}
            </p>
            {isLive && (
              <p className="text-xs text-muted-foreground">
                出題日を入れて承認すると投稿管理の予約に並び、出題日を空欄で承認すると予備問題になります。承認済みの問題は「出題日を設定」で日付を入れたり、予備に戻したりできます。
                {!aiReady && " Gemini が未設定のため、再検証は使えません（GAS の GEMINI_API_KEY）。"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDialog("edit")} disabled={!canEdit}>
              <Pencil />
              編集
            </Button>
            <Button variant="outline" onClick={reverify} disabled={(isLive && !aiReady) || !canFix || verifying}>
              <RefreshCw className={verifying ? "animate-spin" : undefined} />
              {verifying ? "検証中…" : "再検証"}
            </Button>
            {isLive ? (
              <Button onClick={() => setDialog("plan")} disabled={!can(role, "approve") || q.status !== "approved"}>
                <CalendarPlus />
                {q.plannedDate ? "出題日を変更" : "出題日を設定"}
              </Button>
            ) : (
              <Button onClick={() => setDialog("plan")} disabled={!canPlan || q.status !== "approved"}>
                <CalendarPlus />
                出題計画へ登録
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="その他の操作" />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={duplicate} disabled={!canEdit}>
                  <Copy />
                  複製
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push(`/generate?mode=single&platform=${q.platform}&similar=${q.id}`)}
                  disabled={!can(role, "generate") || (isLive && q.platform === "instagram")}
                >
                  <WandSparkles />
                  類似問題を生成
                </DropdownMenuItem>
                {isLive ? null : (
                  <>
                    <DropdownMenuItem onClick={() => setDialog("reuse")} disabled={!canPlan || !reuseFrom}>
                      <Repeat />
                      再出題候補へ追加
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => actions.regenerateImage(q.id)} disabled={!canFix}>
                      <ImageIcon />
                      画像を再生成
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => actions.setCertification(q.id, "candidate")}
                      disabled={!canFix || q.certification === "candidate" || q.certification === "adopted"}
                    >
                      <Award />
                      検定候補に追加
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/analytics?question=${q.id}`)} disabled={!can(role, "analyze")}>
                  <Sparkles />
                  AI定性分析
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadCsv(`${q.id}.csv`, questionsToCsv([q], categoryName))}>
                  <Download />
                  CSV出力
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {q.status === "review" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <ShieldCheck className="size-4 text-warning" aria-hidden />
            <span>この問題は確認待ちです。承認キューで承認・差し戻しを行えます。</span>
            <Link href={`/reviews?q=${q.id}`} className="ml-auto font-medium text-primary hover:underline">
              承認キューを開く
            </Link>
          </div>
        )}
      </header>
      {isLive && <LiveReturnNotice q={q} />}
      {isLive && <LiveSuggestion q={q} />}

      <QuestionDetailTabs
        q={q}
        questions={data.questions}
        postJobs={data.postJobs}
        categoryName={categoryName}
        rules={state.settings.rules}
        today={DEMO_TODAY}
      />

      <EditQuestionDialog key={`edit-${q.updatedAt}`} q={q} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      {isLive && dialog === "plan" && <LiveAssignDateDialog q={q} open onOpenChange={(o) => !o && setDialog(null)} />}
      <AssignToPlanDialog
        key={`plan-${dialog}`}
        q={q}
        open={!isLive && (dialog === "plan" || dialog === "reuse")}
        onOpenChange={(o) => !o && setDialog(null)}
        reuseFrom={dialog === "reuse" ? reuseFrom : undefined}
      />
    </div>
  )
}
