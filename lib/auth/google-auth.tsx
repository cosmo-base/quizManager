"use client"

// ログイン。Google でログインする（またはポータルから引き継ぐ）と、GAS が7日もつセッションを出す。
// クライアント ID はビルド時に NEXT_PUBLIC_GOOGLE_CLIENT_ID で渡す。未設定なら機能を出さない。
// - セッションはこのブラウザの localStorage に置く（タブを閉じても、別のタブでもログインしたまま）
// - ポータルの「開く」から来たときは、URL の #fsif_ticket=…（引換券）でログインする（Google の画面は出ない）
// - 使えるかどうかと権限は、GAS が毎回確かめる（アクセス権限管理につないでいればそちら。役割を外せば最大5分で使えなくなる）
// - ログアウトしたら自動ログインを止める（disableAutoSelect）。ポータルのログアウトとは別
// 古い GAS（startSession が無い）のときは、以前と同じく Google の ID トークン（約1時間）をそのまま使う。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { GasError, setAuthExpiredHandler, setGasToken, startGasSession } from "@/lib/services/gas-client"

// 前後に改行が混ざると Google が invalid_client を返すため trim する
export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim()
const GIS_SRC = "https://accounts.google.com/gsi/client"
const STORAGE_KEY = "cbquiz.session"
const TICKET_PARAM = "fsif_ticket"
/** 残りがこれより短い保存済みのログインは使わない */
const MIN_REMAINING_MS = 60 * 1000

interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (res: { credential: string }) => void; auto_select?: boolean; use_fedcm_for_prompt?: boolean }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
  prompt(): void
  disableAutoSelect(): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

interface AuthState {
  configured: boolean
  ready: boolean
  email: string | null
  signOut: () => void
  /** ログインボタンを描画する要素に渡す ref */
  buttonRef: (el: HTMLElement | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

/** 保存するログイン（セッション。古い GAS なら ID トークン） */
interface Stored {
  token: string
  email: string
  expiresAt: string
}

function decodePayload(token: string): { email?: string; exp?: number } {
  const part = token.split(".")[1] ?? ""
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
  return JSON.parse(decodeURIComponent(Array.from(json, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")))
}

function readStored(): Stored | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Stored | null
    return s?.token && Date.parse(s.expiresAt) - Date.now() > MIN_REMAINING_MS ? s : null
  } catch {
    return null
  }
}
function writeStored(s: Stored | null) {
  try {
    if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 保存できない環境（プライベートモードなど）では、開き直すたびにログインする
  }
}

/** URL の #fsif_ticket=…（ポータルからの引換券）を取り出し、URL からは消す */
function takeTicket(): string {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const ticket = hash.get(TICKET_PARAM)
    if (!ticket) return ""
    hash.delete(TICKET_PARAM)
    const rest = hash.toString()
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (rest ? "#" + rest : ""))
    return ticket
  } catch {
    return ""
  }
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Google ログインの読み込みに失敗しました"))
    document.head.appendChild(s)
  })
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonEl = useRef<HTMLElement | null>(null)

  const clear = useCallback(() => {
    setGasToken(null)
    setEmail(null)
    writeStored(null)
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
  }, [])

  /** ログインを使い始める。期限が来たらログアウト状態に戻す */
  const accept = useCallback(
    (s: Stored) => {
      setGasToken(s.token)
      setEmail(s.email)
      writeStored(s)
      if (expiryTimer.current) clearTimeout(expiryTimer.current)
      expiryTimer.current = setTimeout(clear, Math.min(Math.max(0, Date.parse(s.expiresAt) - Date.now()), 2_000_000_000))
    },
    [clear],
  )

  /** Google の ID トークンか引換券で、GAS にセッションを頼む */
  const begin = useCallback(
    async (cred: { idToken: string } | { ticket: string }) => {
      try {
        const r = await startGasSession(cred)
        if (r) return accept({ token: r.session, email: r.me.email, expiresAt: r.expiresAt })
        // 古い GAS：ID トークンをそのまま使う（約1時間）
        if ("idToken" in cred) {
          const { email, exp } = decodePayload(cred.idToken)
          accept({ token: cred.idToken, email: email ?? "", expiresAt: new Date(exp ? exp * 1000 : Date.now() + 3600_000).toISOString() })
        }
      } catch (e) {
        // 使えないアカウント：ID トークンのまま進め、ログイン画面に理由と「別のアカウントでログイン」を出す
        if ("idToken" in cred && e instanceof GasError && e.reason === "not_allowed") {
          const { email, exp } = decodePayload(cred.idToken)
          accept({ token: cred.idToken, email: email ?? "", expiresAt: new Date(exp ? exp * 1000 : Date.now() + 3600_000).toISOString() })
        }
        // 引換券がだめなときは、ふつうのログイン（ボタン・自動ログイン）で入れる
      }
    },
    [accept],
  )

  const renderButton = useCallback(() => {
    if (buttonEl.current && window.google) {
      window.google.accounts.id.renderButton(buttonEl.current, { type: "standard", theme: "outline", size: "medium", text: "signin_with", locale: "ja" })
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    setAuthExpiredHandler(clear)
    void (async () => {
      // ポータルからの引換券 → 保存済みのログイン → Google の自動ログイン の順に試す
      const ticket = takeTicket()
      if (ticket) await begin({ ticket })
      const stored = readStored()
      if (stored) accept(stored)
      const signedIn = !!stored
      try {
        await loadGis()
      } catch {
        setReady(false)
        return
      }
      if (cancelled || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        // 一度ログインしたアカウントなら、ボタンを押さずにログインし直す（ログアウト後は disableAutoSelect で止まる）
        auto_select: true,
        use_fedcm_for_prompt: true,
        callback: ({ credential }) => void begin({ idToken: credential }),
      })
      setReady(true)
      renderButton()
      if (!signedIn) window.google.accounts.id.prompt()
    })()
    return () => {
      cancelled = true
      setAuthExpiredHandler(null)
    }
  }, [accept, begin, clear, renderButton])

  const buttonRef = useCallback(
    (el: HTMLElement | null) => {
      buttonEl.current = el
      if (el && ready) renderButton()
    },
    [ready, renderButton],
  )

  const signOut = useCallback(() => {
    window.google?.accounts.id.disableAutoSelect()
    clear()
  }, [clear])

  return <AuthContext.Provider value={{ configured: !!GOOGLE_CLIENT_ID, ready, email, signOut, buttonRef }}>{children}</AuthContext.Provider>
}

export function useGoogleAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useGoogleAuth は GoogleAuthProvider の内側で使ってください")
  return ctx
}
