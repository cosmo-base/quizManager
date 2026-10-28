"use client"

// 実APIモード：自分の権限を申請する。管理者が「設定 → ユーザー」で承認・却下する（GAS の requestRole）。
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SimpleSelect } from "@/components/shared/simple-select"
import { ROLE_LABEL } from "@/lib/constants"
import { useQuiz } from "@/lib/store/quiz-store"
import type { Role } from "@/lib/types"

const REQUESTABLE: { value: Role; label: string }[] = [
  { value: "editor", label: `${ROLE_LABEL.editor}（問題の作成・編集・AI生成）` },
  { value: "approver", label: `${ROLE_LABEL.approver}（承認・投稿）` },
  { value: "admin", label: `${ROLE_LABEL.admin}（すべての操作・ユーザー管理）` },
]

export function RoleRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, actions } = useQuiz()
  const me = state.liveStatus.me
  const options = REQUESTABLE.filter((o) => o.value !== me?.role)
  const [role, setRole] = useState<Role>(options[0]?.value ?? "editor")
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    const done = await actions.requestLiveRole(role, note.trim())
    setSending(false)
    if (done) {
      setNote("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>権限を申請</DialogTitle>
            <DialogDescription>
              現在の権限：{me ? ROLE_LABEL[me.role] : "—"}。管理者が承認すると反映されます。
              {me?.pendingRequest && `（申請中：${ROLE_LABEL[me.pendingRequest.role]}。新しく申請すると置き換わります）`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rr-role">申請する権限</Label>
            <SimpleSelect id="rr-role" value={role} onChange={setRole} options={options} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rr-note">理由（任意）</Label>
            <Input id="rr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="例：問題の作成を担当します" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={sending || !options.length}>
              {sending ? "送信中…" : "申請する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
