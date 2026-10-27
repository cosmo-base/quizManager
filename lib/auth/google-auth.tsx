"use client"

// Google ログイン（Google Identity Services）。ID トークンを GAS 送信用に保持する。
// クライアント ID はビルド時に NEXT_PUBLIC_GOOGLE_CLIENT_ID で渡す。未設定なら機能を出さない。
// 表示用にトークンの中身（email・有効期限）を読むだけで、検証は GAS 側で行う。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { setGasIdToken } from "@/lib/services/gas-client"

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
const GIS_SRC = "https://accounts.google.com/gsi/client"

interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (res: { credential: string }) => void; auto_select?: boolean; use_fedcm_for_prompt?: boolean }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
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
    setGasIdToken(null)
    setEmail(null)
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
  }, [])

  const renderButton = useCallback(() => {
    if (buttonEl.current && window.google) {
      window.google.accounts.id.renderButton(buttonEl.current, { type: "standard", theme: "outline", size: "medium", text: "signin_with", locale: "ja" })
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !window.google) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          auto_select: false,
          use_fedcm_for_prompt: true,
          callback: ({ credential }) => {
            const { email, exp } = decodePayload(credential)
            setGasIdToken(credential)
            setEmail(email ?? null)
            // ID トークンは約 1 時間で失効する。失効したらログアウト状態に戻す
            if (expiryTimer.current) clearTimeout(expiryTimer.current)
            if (exp) expiryTimer.current = setTimeout(clear, Math.max(0, exp * 1000 - Date.now()))
          },
        })
        setReady(true)
        renderButton()
      })
      .catch(() => setReady(false))
    return () => {
      cancelled = true
    }
  }, [clear, renderButton])

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
