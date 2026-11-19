"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useQuiz } from "@/lib/store/quiz-store"
import { getBackend } from "@/lib/services"
import type { ArchiveNotice, ArchiveSaveNoticeInput } from "@/lib/services/gas-contract"
import { errorMessage, formatJst, isoToJstInput, jstInputToIso } from "@/lib/archive"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SimpleSelect } from "@/components/shared/simple-select"
import { EmptyState } from "@/components/shared/states"

const EMPTY: ArchiveSaveNoticeInput = { kind: "info", title: "", summary: "", body: "", questionId: "", before: "", after: "", publishedAt: "", endsAt: "" }

function stateOf(n: ArchiveNotice, now: number): { label: string; variant: "secondary" | "outline" | "destructive" } {
  if (n.endsAt && new Date(n.endsAt).getTime() <= now) return { label: "終了", variant: "outline" }
  if (n.publishedAt && new Date(n.publishedAt).getTime() > now) return { label: "公開前", variant: "outline" }
  return { label: "公開中", variant: "secondary" }
}

/** 過去問サイトのお知らせ・訂正 */
export function ArchiveNoticesTab({
  canEdit,
  draft,
  onDraftUsed,
  onOpenQuestion,
}: {
  canEdit: boolean
  draft: ArchiveSaveNoticeInput | null
  onDraftUsed: () => void
  onOpenQuestion: (id: string) => void
}) {
  const { state } = useQuiz()
  const backend = getBackend(state.settings.dataMode)
  const [notices, setNotices] = useState<ArchiveNotice[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ArchiveSaveNoticeInput | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    backend
      .archiveListNotices()
      .then((r) => setNotices(r.notices))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [backend])
  useEffect(() => load(), [load])
  // 問題の画面から来た訂正のお知らせの下書きを開く
  useEffect(() => {
    if (draft) {
      setEditing(draft)
      onDraftUsed()
    }
  }, [draft, onDraftUsed])

  const now = Date.now()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus data-icon="inline-start" />
            新しいお知らせ
          </Button>
        )}
        <Button variant="outline" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
          読み込み直す
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {notices === null ? (
        !error && <p className="text-sm text-muted-foreground">読み込んでいます…</p>
      ) : notices.length === 0 ? (
        <EmptyState title="お知らせはまだありません" />
      ) : (
        <ul className="flex flex-col gap-3">
          {notices.map((n) => {
            const st = stateOf(n, now)
            return (
              <li key={n.noticeId} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={n.kind === "correction" ? "destructive" : "outline"}>{n.kind === "correction" ? "訂正" : "お知らせ"}</Badge>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="font-medium">{n.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  公開 {formatJst(n.publishedAt)}
                  {n.endsAt && `・終了 ${formatJst(n.endsAt)}`}
                  {n.questionId && (
                    <>
                      {"・"}
                      <button type="button" className="font-mono text-primary underline-offset-4 hover:underline" onClick={() => onOpenQuestion(n.questionId)}>
                        {n.questionId}
                      </button>
                    </>
                  )}
                </p>
                {n.summary && <p className="text-sm">{n.summary}</p>}
                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing({ ...n })}>
                      直す
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <NoticeDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(input) =>
          backend.archiveSaveNotice(input).then(() => {
            toast.success(input.noticeId ? "お知らせを直しました" : "お知らせを作りました", { description: "過去問サイトにすぐ反映されます" })
            setEditing(null)
            load()
          })
        }
      />
    </div>
  )
}

function NoticeDialog({ value, onClose, onSave }: { value: ArchiveSaveNoticeInput | null; onClose: () => void; onSave: (v: ArchiveSaveNoticeInput) => Promise<void> }) {
  const [f, setF] = useState<ArchiveSaveNoticeInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (value) {
      setF(value)
      setError("")
    }
  }, [value])
  const set = <K extends keyof ArchiveSaveNoticeInput>(k: K, v: ArchiveSaveNoticeInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const correction = f.kind === "correction"
  const invalid = !f.title.trim() || (correction && !f.questionId.trim())

  const submit = () => {
    if (saving || invalid) return
    setSaving(true)
    setError("")
    onSave(f)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setSaving(false))
  }

  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{f.noticeId ? "お知らせを直す" : "新しいお知らせ"}</DialogTitle>
          <DialogDescription>過去問サイトのホームとお知らせの一覧に出ます。公開日時を空にすると、保存した時点で公開します。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntc-kind">種類</Label>
            <SimpleSelect
              id="ntc-kind"
              value={f.kind}
              onChange={(v) => set("kind", v)}
              options={[
                { value: "info", label: "お知らせ" },
                { value: "correction", label: "訂正（問題の正解・内容を直したとき）" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntc-title">タイトル</Label>
            <Input id="ntc-title" value={f.title} maxLength={100} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntc-summary">要約（一覧に出る1行）</Label>
            <Input id="ntc-summary" value={f.summary} maxLength={200} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ntc-body">本文（改行で段落を分けます）</Label>
            <Textarea id="ntc-body" rows={5} value={f.body} onChange={(e) => set("body", e.target.value)} />
          </div>
          {correction && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ntc-qid">問題ID</Label>
                <Input id="ntc-qid" placeholder="Q-0001" value={f.questionId} onChange={(e) => set("questionId", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ntc-before">訂正前</Label>
                <Input id="ntc-before" value={f.before} onChange={(e) => set("before", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ntc-after">訂正後</Label>
                <Input id="ntc-after" value={f.after} onChange={(e) => set("after", e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ntc-pub">公開日時（日本時間）</Label>
              <Input id="ntc-pub" type="datetime-local" value={isoToJstInput(f.publishedAt)} onChange={(e) => set("publishedAt", jstInputToIso(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ntc-end">終了日時（空なら出し続ける）</Label>
              <Input id="ntc-end" type="datetime-local" value={isoToJstInput(f.endsAt)} onChange={(e) => set("endsAt", jstInputToIso(e.target.value))} />
            </div>
          </div>
          {f.noticeId && (
            <Button variant="outline" size="sm" className="self-start" onClick={() => set("endsAt", new Date().toISOString())}>
              今すぐ終了にする（保存で反映）
            </Button>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            やめる
          </Button>
          <Button disabled={saving || invalid} onClick={submit}>
            {saving ? "保存しています…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
