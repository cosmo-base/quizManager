"use client"

// 実APIモードのログイン画面。ログインするまで（または許可されていないアカウントのときは）画面全体をこれにする。
// 本人確認は Google、利用の可否と権限は GAS（ALLOWED_EMAILS・USER_ROLES・管理者が付けた権限）が決める。
import { LogOut, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark } from "./sidebar-nav"
import { useGoogleAuth } from "@/lib/auth/google-auth"
import { useQuiz } from "@/lib/store/quiz-store"

export function LoginGate() {
  const auth = useGoogleAuth()
  const { state, actions } = useQuiz()
  const error = state.liveStatus.authError

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-background p-6 shadow-sm">
        <BrandMark onLight />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold">ログイン</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">毎日宇宙クイズの運用画面です。許可された Google アカウントでログインしてください。</p>
        </div>

        {!auth.configured ? (
          <p role="alert" className="text-sm text-destructive">
            Google ログインが設定されていません（ビルド時の NEXT_PUBLIC_GOOGLE_CLIENT_ID）。
          </p>
        ) : error && auth.email ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {error}
                <span className="mt-1 block text-xs break-all text-muted-foreground">{auth.email}</span>
              </span>
            </p>
            <Button variant="outline" onClick={() => actions.refreshLive()} disabled={state.liveStatus.loading}>
              <RefreshCw className={state.liveStatus.loading ? "animate-spin" : undefined} aria-hidden />
              もう一度試す
            </Button>
            <Button variant="outline" onClick={auth.signOut}>
              <LogOut aria-hidden />
              別のアカウントでログイン
            </Button>
          </div>
        ) : auth.email ? (
          <p className="text-sm text-muted-foreground" role="status">
            確認しています…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div ref={auth.buttonRef} aria-label="Google でログイン" className="min-h-10" />
            {!auth.ready && <p className="text-xs text-muted-foreground">Google ログインを読み込んでいます…</p>}
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">ログイン後の権限（閲覧・編集・承認・管理）は管理者が設定します。必要な権限は、ログイン後に「設定 → ユーザー」から申請できます。</p>
      </div>
    </div>
  )
}
