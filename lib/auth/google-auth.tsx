"use client"

// Google ログイン（Google Identity Services）。ID トークンを GAS 送信用に保持する。
// クライアント ID はビルド時に NEXT_PUBLIC_GOOGLE_CLIENT_ID で渡す。未設定なら機能を出さない。
// 表示用にトークンの中身（email・有効期限）を読むだけで、検証は GAS 側で行う。
// ログインを保つ：ID トークン（約 1 時間で失効）はそのタブの sessionStorage にだけ置き、開き直しても失効までは使う。
// 失効の少し前と、保存がないときは Google の自動ログイン（prompt。一度ログインしたブラウザならボタン不要）で取り直す。
// ログアウトしたら自動ログインを止める（disableAutoSelect）。localStorage には置かない（タブを閉じれば消える）。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { setGasIdToken } from "@/lib/services/gas-client"

// 前後に改行が混ざると Google が invalid_client を返すため trim する
export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim()
const GIS_SRC = "https://accounts.google.com/gsi/client"
const STORAGE_KEY = "cbquiz.idToken"
/** 失効のこの時間前に取り直しを始める */
const RENEW_BEFORE_MS = 5 * 60 * 1000
/** 残りがこれより短い保存済みトークンは使わない */
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

function decodePayload(token: string): { email?: string; exp?: number } {
  const part = token.split(".")[1] ?? ""
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
  return JSON.parse(decodeURIComponent(Array.from(json, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")))
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeStored(token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // 保存できない環境（プライベートモードなど）では、開き直すたびにログインする
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
  const renewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const buttonEl = useRef<HTMLElement | null>(null)

  const clearTimers = () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
    if (renewTimer.current) clearTimeout(renewTimer.current)
  }

  const clear = useCallback(() => {
    setGasIdToken(null)
    setEmail(null)
    writeStored(null)
    clearTimers()
  }, [])

  /** Google の自動ログインを試す（できないときは何も起きず、ログイン画面のボタンで入る） */
  const tryAutoSignIn = useCallback(() => {
    const id = window.google?.accounts?.id
    if (id && typeof id.prompt === "function") id.prompt()
  }, [])

  /** トークンを使い始める。失効の少し前に取り直し、失効したらログアウト状態に戻す */
  const accept = useCallback(
    (credential: string) => {
      const { email, exp } = decodePayload(credential)
      setGasIdToken(credential)
      setEmail(email ?? null)
      writeStored(credential)
      clearTimers()
      if (exp) {
        const remaining = exp * 1000 - Date.now()
        renewTimer.current = setTimeout(tryAutoSignIn, Math.max(0, remaining - RENEW_BEFORE_MS))
        expiryTimer.current = setTimeout(clear, Math.max(0, remaining))
      }
    },
    [clear, tryAutoSignIn],
  )

  const renderButton = useCallback(() => {
    if (buttonEl.current && window.google) {
      window.google.accounts.id.renderButton(buttonEl.current, { type: "standard", theme: "outline", size: "medium", text: "signin_with", locale: "ja" })
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    // 開き直したとき：まだ十分に有効な保存済みトークンがあれば、そのまま使う
    let storedUsed = false
    const stored = readStored()
    if (stored) {
      try {
        const { exp } = decodePayload(stored)
        if (exp && exp * 1000 - Date.now() > MIN_REMAINING_MS) {
          accept(stored)
          storedUsed = true
        } else writeStored(null)
      } catch {
        writeStored(null)
      }
    }
    loadGis()
      .then(() => {
        if (cancelled || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          // 一度ログインしたアカウントなら、ボタンを押さずにログインし直す（ログアウト後は disableAutoSelect で止まる）
          auto_select: true,
          use_fedcm_for_prompt: true,
          callback: ({ credential }) => accept(credential),
        })
        setReady(true)
        renderButton()
        if (!storedUsed) tryAutoSignIn()
      })
      .catch(() => setReady(false))
    return () => {
      cancelled = true
    }
  }, [accept, renderButton, tryAutoSignIn])

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
