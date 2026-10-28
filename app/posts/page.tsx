"use client"

import { useMemo, useState } from "react"
import { FlaskConical, RefreshCw, Send, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState, PermissionNote } from "@/components/shared/states"
import { SimpleSelect } from "@/components/shared/simple-select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PostTable, type PostAction } from "@/components/posts/post-table"
import { InstagramStock, ScheduleQueue } from "@/components/posts/side-panels"
import { AutomationCard } from "@/components/posts/automation-card"
import { PostPreviewDialog, RecordUrlDialog, RescheduleDialog } from "@/components/posts/post-dialogs"
import { PLATFORM_LABEL } from "@/lib/constants"
import { formatTime } from "@/lib/format"
import { useQuiz } from "@/lib/store/quiz-store"
import type { PostJob, PostStatus } from "@/lib/types"
import { can, liveScheduleIssues } from "@/lib/validation"

type StatusFilter = "all" | "attention" | PostStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべての状態" },
  { value: "attention", label: "要対応のみ" },
  { value: "scheduled", label: "予約済み" },
  { value: "posted", label: "投稿済み" },
  { value: "failed", label: "投稿失敗" },
  { value: "unknown", label: "公開状況不明" },
  { value: "manual", label: "手動対応" },
]

const ATTENTION: PostStatus[] = ["failed", "unknown", "manual"]

type DialogState =
  | { kind: "preview"; job: PostJob }
  | { kind: "reschedule"; job: PostJob }
  | { kind: "cancel"; job: PostJob }
  | { kind: "recordManual"; job: PostJob }
  | { kind: "recordIg"; questionId: string }
  | { kind: "confirmSend"; job: PostJob; action: "postNow" | "reveal" }
  | null

export default function PostsPage() {
  const { state, data, actions } = useQuiz()
  const [platform, setPlatform] = useState<"all" | "x" | "discord">("all")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [dialog, setDialog] = useState<DialogState>(null)
  const [syncing, setSyncing] = useState(false)

  const canPost = can(state.role, "post")
  const isLive = state.settings.dataMode === "live"
  const { dryRun, discordDryRun, discordConfigured, loading } = state.liveStatus
  const dryRunOf = (p: PostJob["platform"]) => (p === "discord" ? discordDryRun : dryRun)
  // どちらかの媒体が本番投稿なら赤い帯で知らせる
  const anyLive = dryRun === false || (discordConfigured && discordDryRun === false)
  const questionMap = useMemo(() => new Map(data.questions.map((q) => [q.id, q])), [data.questions])
  const xIntegration = data.integrations.find((i) => i.key === "x")

  const jobs = useMemo(
    () =>
      data.postJobs
        .filter((j) => j.platform !== "instagram" && j.status !== "cancelled")
        .filter((j) => platform === "all" || j.platform === platform)
        .filter((j) => (status === "all" ? true : status === "attention" ? ATTENTION.includes(j.status) : j.status === status))
        .sort((a, b) => b.date.localeCompare(a.date) || a.platform.localeCompare(b.platform)),
    [data.postJobs, platform, status],
  )

  const scheduledIds = useMemo(
    () => new Set(data.postJobs.filter((j) => j.status !== "cancelled").map((j) => j.questionId)),
    [data.postJobs],
  )
  const waiting = data.questions
    .filter((q) => q.platform !== "instagram" && q.status === "approved" && !scheduledIds.has(q.id))
    .sort((a, b) => (a.plannedDate ?? "9999").localeCompare(b.plannedDate ?? "9999"))
  const igStock = data.questions.filter((q) => q.platform === "instagram" && q.status === "approved")
  const unsyncedCount = data.postJobs.filter(
    (j) => j.responseStatus === "finalized" && ["unsynced", "failed", "needs_check"].includes(j.syncStatus),
  ).length

  const onAction = (job: PostJob, action: PostAction) => {
    switch (action) {
      case "preview":
      case "reschedule":
      case "cancel":
      case "recordManual":
        setDialog({ kind: action, job })
        break
      case "postNow":
        // 実APIモードは X・Discord に送るため、必ず確認してから実行する
        if (isLive) setDialog({ kind: "confirmSend", job, action: "postNow" })
        else actions.postNow(job.id)
        break
      case "check":
        actions.checkPostStatus(job.id)
        break
      case "reveal":
        if (isLive) setDialog({ kind: "confirmSend", job, action: "reveal" })
        else actions.revealAnswer(job.id)
        break
      case "fetch":
        actions.fetchResults(job.id)
        break
      case "manual":
        actions.switchToManual(job.id)
        break
    }
  }

  const sync = async () => {
    setSyncing(true)
    try {
      await actions.syncSheets()
    } finally {
      setSyncing(false)
    }
  }

  const activeJob = dialog && "job" in dialog ? dialog.job : null
  const confirmPlatform = dialog?.kind === "confirmSend" ? dialog.job.platform : "x"
  const confirmName = PLATFORM_LABEL[confirmPlatform]
  const confirmDry = dryRunOf(confirmPlatform) !== false
  const confirmTitle =
    dialog?.kind === "confirmSend" && dialog.action === "reveal"
      ? confirmPlatform === "discord"
        ? "締め切って、正解・解説を返信しますか？"
        : "正解・解説をリプライしますか？"
      : `${confirmName} に問題を投稿しますか？`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="投稿管理"
        description={`X・Discordへの投稿予約と結果取得。原則 ${state.settings.posting.defaultTime}（日本時間）に投稿します。`}
        actions={
          isLive ? (
            <Button variant="outline" onClick={() => actions.refreshLive()} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin" : undefined} />
              正本から再読み込み
            </Button>
          ) : (
            <Button variant="outline" onClick={sync} disabled={syncing || unsyncedCount === 0 || !canPost}>
              <RefreshCw className={syncing ? "animate-spin" : undefined} />
              Sheetsへ同期（{unsyncedCount}）
            </Button>
          )
        }
      />

      {isLive && dryRun !== null && (
        <div
          role="note"
          className={
            !anyLive
              ? "flex items-start gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm"
              : "flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          }
        >
          {!anyLive ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden /> : <Send className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
          <p className="leading-relaxed">
            {dryRun
              ? "X はドライラン中です。投稿・正解発表を実行しても X には送らず、正本（Sheets）に記録だけ残します（GAS の X_DRY_RUN）。"
              : "X は本番投稿モードです。「今すぐ投稿」「正解を発表」は運用中の X アカウントに実際に投稿されます。"}
            {!discordConfigured
              ? " Discord の Bot は未設定です（GAS の DISCORD_BOT_TOKEN・DISCORD_QUIZ_CHANNEL_ID）。"
              : discordDryRun === false
                ? " Discord は本番投稿モードです（出題チャンネルに実際に投稿されます）。"
                : " Discord はドライラン中です（GAS の DISCORD_DRY_RUN）。"}
            承認済みで出題日がある問題が「予約済み」として並びます。
          </p>
        </div>
      )}

      {!canPost && <PermissionNote role={state.role} need="投稿操作" />}

      {xIntegration?.status === "unverified" && (
        <div role="note" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="leading-relaxed">
            X APIは技術検証中です（{xIntegration.note}）。自動投稿できない場合は「手動対応へ切替」で投稿パッケージを作成し、手動投稿後にURLを記録してください。
            公開状況が不明な投稿は、確認するまで自動再投稿しません。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col gap-3" aria-label="投稿一覧">
          <div className="flex flex-wrap items-center gap-2">
            <SimpleSelect
              value={platform}
              onChange={(v) => setPlatform(v as typeof platform)}
              options={[
                { value: "all", label: "すべての媒体" },
                { value: "x", label: "X" },
                { value: "discord", label: "Discord" },
              ]}
              aria-label="媒体"
              className="w-40"
            />
            <SimpleSelect
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={STATUS_FILTERS}
              aria-label="投稿状態"
              className="w-40"
            />
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">{jobs.length}件</span>
          </div>
          {jobs.length === 0 ? (
            <EmptyState title="該当する投稿はありません" description="絞り込み条件を変更してください" />
          ) : (
            <PostTable jobs={jobs} questions={questionMap} disabled={!canPost} onAction={onAction} />
          )}
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          {isLive && <AutomationCard status={state.liveStatus.automation} />}
          <ScheduleQueue
            questions={waiting}
            disabled={!canPost}
            onSchedule={actions.schedulePost}
            liveIssues={isLive ? (q) => liveScheduleIssues(q, data.postJobs, discordConfigured) : undefined}
          />
          <InstagramStock
            questions={igStock}
            minStock={state.settings.posting.instagramMinStock}
            disabled={!canPost}
            onRecord={(id) => setDialog({ kind: "recordIg", questionId: id })}
          />
        </div>
      </div>

      <PostPreviewDialog
        q={activeJob ? (questionMap.get(activeJob.questionId) ?? null) : null}
        platform={activeJob?.platform ?? "x"}
        open={dialog?.kind === "preview"}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      {dialog?.kind === "reschedule" && (
        <RescheduleDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          initial={formatTime(dialog.job.scheduledAt)}
          onSubmit={(time) => actions.reschedulePost(dialog.job.id, time)}
        />
      )}
      <Dialog open={dialog?.kind === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>投稿予約を取り消しますか？</DialogTitle>
            <DialogDescription>
              問題は承認済みに戻り、出題枠は空き枠になります。投稿済みの外部投稿は削除されません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              戻る
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (activeJob) actions.cancelPost(activeJob.id)
                setDialog(null)
              }}
            >
              取り消す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog?.kind === "confirmSend"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
            <DialogDescription>
              {confirmDry
                ? `ドライラン中のため ${confirmName} には送らず、記録だけ残します。`
                : confirmPlatform === "discord"
                  ? "Discord の出題チャンネルに実際に投稿されます。取り消すには Discord 上で削除が必要です。"
                  : "運用中の X アカウントに実際に投稿されます。取り消すには X 上で削除が必要です。"}
              {activeJob && ` 対象：${activeJob.date} / ${activeJob.questionId}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              戻る
            </Button>
            <Button
              variant={confirmDry ? "default" : "destructive"}
              onClick={() => {
                if (dialog?.kind === "confirmSend") {
                  if (dialog.action === "postNow") actions.postNow(dialog.job.id)
                  else actions.revealAnswer(dialog.job.id)
                }
                setDialog(null)
              }}
            >
              {confirmDry ? "記録する（ドライラン）" : "投稿する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RecordUrlDialog
        open={dialog?.kind === "recordManual" || dialog?.kind === "recordIg"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "recordIg" ? "Instagram投稿を記録" : "手動投稿を記録"}
        description="手動で投稿した後、投稿URLを記録すると出題履歴と回答取得の対象になります。"
        onSubmit={(url) => {
          if (dialog?.kind === "recordIg") actions.recordInstagramPost(dialog.questionId, url)
          else if (activeJob) actions.markManualPosted(activeJob.id, url)
        }}
      />
    </div>
  )
}
