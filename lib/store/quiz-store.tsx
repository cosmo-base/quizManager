"use client"

import { questionHref } from "@/lib/routes"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { produce, type Draft } from "immer"
import { toast } from "sonner"
import type {
  ActivityLog,
  AIInsight,
  AppNotification,
  AppUser,
  Category,
  ChoiceLabel,
  DataMode,
  GenerationJob,
  GenerationOptions,
  ImageTemplate,
  Integration,
  PlanSlot,
  Platform,
  PostJob,
  Question,
  Role,
  SyncLog,
  SystemSettings,
  UsageRecord,
  WeeklyTemplateRow,
  CertificationStatus,
} from "@/lib/types"
import {
  CATEGORIES,
  DEFAULT_SETTINGS,
  GENERATION_POOL,
  makeGeneratedQuestion,
  MOCK_ACTIVITY,
  MOCK_INSIGHTS,
  MOCK_INTEGRATIONS,
  MOCK_JOBS,
  MOCK_NOTIFICATIONS,
  MOCK_POST_JOBS,
  MOCK_QUESTIONS,
  MOCK_SLOTS,
  MOCK_SYNC_LOGS,
  MOCK_TEMPLATES,
  MOCK_USAGE,
  MOCK_USERS,
  MOCK_WEEKLY_TEMPLATE,
} from "@/lib/mocks/data"
import { AI_MODELS, PIPELINE_STEPS, PLATFORM_LABEL, ROLE_LABEL } from "@/lib/constants"
import { addDays, addMonths, dateRange, DEMO_TODAY, jstIso, jstToday, shortHash, weekday } from "@/lib/format"
import { getBackend, NotConnectedError, type QuizBackend } from "@/lib/services"
import type { GasAiStatus, GasAutomationStatus, GasConfigSummary, GasMe, GasPlan, GenerateQuestionsInput, ImportQuestionInput, ImportQuestionsResult, SaveQuestionInput } from "@/lib/services/gas-contract"
import { GasError } from "@/lib/services/gas-client"
import { LIVE_AVAILABLE } from "@/lib/live/env"
import { useGoogleAuth } from "@/lib/auth/google-auth"
import { scheduledJobsFor, toPostJob, toQuestion, toResponseSnapshot, type LivePlan } from "@/lib/live/mappers"
import { can, canSchedule, checkReuse, describeConflict, type Permission } from "@/lib/validation"

export interface AppData {
  questions: Question[]
  slots: PlanSlot[]
  weeklyTemplate: WeeklyTemplateRow[]
  postJobs: PostJob[]
  jobs: GenerationJob[]
  notifications: AppNotification[]
  activity: ActivityLog[]
  integrations: Integration[]
  insights: AIInsight[]
  syncLogs: SyncLog[]
  imageTemplates: ImageTemplate[]
  users: AppUser[]
  usage: UsageRecord[]
  categories: Category[]
}

/** 実APIモードの読み込み状態。dryRun は GAS の X_DRY_RUN、discordDryRun は DISCORD_DRY_RUN（null は未取得） */
export interface LiveStatus {
  dryRun: boolean | null
  discordDryRun: boolean | null
  /** Discord の Bot が設定済みか（古い GAS では false） */
  discordConfigured: boolean
  /** Gemini の設定と今月の使用量（null は未取得・古い GAS） */
  ai: GasAiStatus | null
  /** ログインした人と GAS が決めた権限（null は未取得） */
  me: GasMe | null
  /** 設定画面に出す GAS の設定の要約（null は未取得・古い GAS） */
  config: GasConfigSummary | null
  /** ログインはできたが使えない理由（許可されていないアカウントなど）。ログイン画面に出す */
  authError: string | null
  loading: boolean
  loadedAt: string | null
  /** 毎朝の自動投稿の状態（null は未取得） */
  automation: GasAutomationStatus | null
}

interface AppState {
  settings: SystemSettings
  role: Role
  userName: string
  demo: AppData
  live: AppData
  liveStatus: LiveStatus
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** デモモードの表示上の名前・権限（権限は画面で切り替えて確認できる） */
const DEMO_IDENTITY: { role: Role; userName: string } = { role: "admin", userName: "山田 太一" }

function demoData(): AppData {
  return clone({
    questions: MOCK_QUESTIONS,
    slots: MOCK_SLOTS,
    weeklyTemplate: MOCK_WEEKLY_TEMPLATE,
    postJobs: MOCK_POST_JOBS,
    jobs: MOCK_JOBS,
    notifications: MOCK_NOTIFICATIONS,
    activity: MOCK_ACTIVITY,
    integrations: MOCK_INTEGRATIONS,
    insights: MOCK_INSIGHTS,
    syncLogs: MOCK_SYNC_LOGS,
    imageTemplates: MOCK_TEMPLATES,
    users: MOCK_USERS,
    usage: MOCK_USAGE,
    categories: CATEGORIES,
  })
}

/** 実APIモードの初期状態：未接続なのでデータは空。サンプルを混ぜない。 */
function liveData(): AppData {
  return {
    questions: [],
    slots: [],
    weeklyTemplate: clone(MOCK_WEEKLY_TEMPLATE),
    postJobs: [],
    jobs: [],
    notifications: [],
    activity: [],
    integrations: MOCK_INTEGRATIONS.map((i) => ({ ...i, status: "disconnected" as const, note: "未接続（接続設定が必要）" })),
    insights: [],
    syncLogs: [],
    imageTemplates: clone(MOCK_TEMPLATES),
    users: [],
    usage: [],
    categories: clone(CATEGORIES),
  }
}

const nowIso = () => new Date().toISOString()
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase()
/** 問題の取り込みで 1 回に GAS へ送る数（GAS 側の上限と同じ） */
const IMPORT_CHUNK = 100

function nextSeq(questions: Question[]) {
  return questions.reduce((m, q) => Math.max(m, Number(q.id.split("-").at(-1)) || 0), 0) + 1
}

export interface GenerationRequest {
  mode: GenerationJob["mode"]
  platforms: Platform[]
  range: { from: string; to: string } | null
  options: GenerationOptions
}

function useQuizStoreValue() {
  // GAS とログインの設定があるビルド（本番）は実APIモードで開き、ログイン画面を出す
  const [state, setState] = useState<AppState>(() => {
    const live = LIVE_AVAILABLE
    return {
      settings: { ...clone(DEFAULT_SETTINGS), dataMode: live ? "live" : "demo" },
      role: live ? "viewer" : DEMO_IDENTITY.role,
      userName: live ? "" : DEMO_IDENTITY.userName,
      demo: demoData(),
      live: liveData(),
      liveStatus: { dryRun: null, discordDryRun: null, discordConfigured: false, ai: null, me: null, config: null, authError: null, loading: false, loadedAt: null, automation: null },
    }
  })
  const stateRef = useRef(state)
  stateRef.current = state
  const auth = useGoogleAuth()

  const data = state.settings.dataMode === "demo" ? state.demo : state.live
  const backend: QuizBackend = getBackend(state.settings.dataMode)

  const update = useCallback((fn: (d: Draft<AppData>, s: Draft<AppState>) => void) => {
    setState((prev) =>
      produce(prev, (draft) => {
        fn(draft.settings.dataMode === "demo" ? draft.demo : draft.live, draft)
      }),
    )
  }, [])

  const isDemo = () => stateRef.current.settings.dataMode === "demo"
  const label = (msg: string) => (isDemo() ? `【デモ】${msg}` : msg)

  /** 権限を確認する。opts.live が無い操作は、実APIモードでは未対応として止める */
  const guard = useCallback((operation: string, permission?: Permission | Permission[], opts?: { live?: boolean }) => {
    const s = stateRef.current
    const perms = permission ? (Array.isArray(permission) ? permission : [permission]) : []
    if (perms.length && !perms.some((p) => can(s.role, p))) {
      toast.error("権限がありません", { description: `${operation}には別の権限が必要です（現在：${s.role}）` })
      return false
    }
    if (s.settings.dataMode === "live" && !opts?.live) {
      toast.error(`${operation}：実APIモードでは未対応です`, { description: LIVE_AVAILABLE ? "正本（GAS・Sheets）にまだつないでいない操作です" : "正本（GAS・Sheets）にまだつないでいない操作です。デモモードで試せます" })
      return false
    }
    return true
  }, [])

  const callBackend = useCallback(async <T,>(operation: string, fn: (b: QuizBackend) => Promise<T>): Promise<T | null> => {
    try {
      return await fn(getBackend(stateRef.current.settings.dataMode))
    } catch (e) {
      if (e instanceof NotConnectedError) toast.error(e.message, { description: e.hint })
      else toast.error(`${operation}に失敗しました`, { description: e instanceof Error ? e.message : String(e) })
      return null
    }
  }, [])

  // ---------------- 実APIモード（GAS・正本の Sheets） ----------------
  /** 問題・投稿の一覧と動作状態を GAS から読み直す */
  const refreshLive = useCallback(async () => {
    if (stateRef.current.settings.dataMode !== "live") return
    setState((prev) => ({ ...prev, liveStatus: { ...prev.liveStatus, loading: true } }))
    // 先に自分の権限を確かめる。許可されていないアカウントならログイン画面で案内する
    let me: GasMe
    try {
      me = await getBackend("live").getMe()
    } catch (e) {
      // 許可されていない・GAS が古い・通信の失敗など。どれもログイン画面に理由を出す
      const notAllowed = e instanceof GasError && e.reason === "not_allowed"
      const msg = e instanceof Error ? e.message : String(e)
      setState((prev) =>
        produce(prev, (draft) => {
          draft.liveStatus.loading = false
          draft.liveStatus.me = null
          draft.liveStatus.authError = notAllowed ? msg : `ユーザー情報を取得できませんでした：${msg}`
        }),
      )
      return
    }
    setState((prev) =>
      produce(prev, (draft) => {
        draft.liveStatus.me = me
        draft.liveStatus.authError = null
        draft.role = me.role
        draft.userName = me.name || me.email
      }),
    )
    const res = await callBackend("正本の読み込み", async (b) => {
      const loaded = await Promise.all([b.getStatus(), b.listQuestions(), b.listPostJobs(), b.getAutomationStatus()])
      // GAS の版が古いなど、想定外の形なら画面のデータは書き換えない
      if (typeof loaded[0]?.dryRun !== "boolean" || !Array.isArray(loaded[1]) || !Array.isArray(loaded[2]) || !Array.isArray(loaded[3]?.recentLog)) {
        throw new Error("GAS の応答が想定と異なります。GAS を最新のコードで「新しいバージョン」としてデプロイしてください")
      }
      return loaded
    })
    setState((prev) =>
      produce(prev, (draft) => {
        draft.liveStatus.loading = false
        if (!res) return
        const [status, gasQuestions, gasJobs, automation] = res
        const time = draft.settings.posting.defaultTime
        const jobs = gasJobs.filter((j) => j.questionId).map((j) => toPostJob(j, time))
        const discordConfigured = status.discordConfigured === true
        // Discord は Bot が設定済みのときだけ予約に並べる（未設定なら「予約待ち」に理由を出す）
        // 21:00 に固定した今日・明日の分（自動投稿の状態から）
        const plans: LivePlan[] = []
        const addPlan = (platform: Platform, date: string, p: GasPlan | null | undefined) => p && plans.push({ ...p, date, platform })
        addPlan("x", automation.today, automation.todayPlan)
        addPlan("x", automation.tomorrow, automation.tomorrowPlan)
        addPlan("discord", automation.today, automation.discord?.todayPlan)
        addPlan("discord", automation.tomorrow, automation.discord?.tomorrowPlan)
        const allJobs = [...jobs, ...scheduledJobsFor(gasQuestions, jobs, time, discordConfigured ? ["x", "discord"] : ["x"], plans)]
        const responses = gasJobs.map(toResponseSnapshot).filter((r) => r !== null)
        draft.live.questions = gasQuestions.map((q) => toQuestion(q, allJobs, responses))
        draft.live.postJobs = allJobs
        draft.liveStatus.dryRun = status.dryRun
        draft.liveStatus.discordDryRun = typeof status.discordDryRun === "boolean" ? status.discordDryRun : null
        draft.liveStatus.discordConfigured = discordConfigured
        draft.liveStatus.ai = status.ai ?? null
        draft.liveStatus.config = status.config ?? null
        draft.liveStatus.automation = automation
        draft.liveStatus.loadedAt = nowIso()
      }),
    )
  }, [callBackend])

  // ログインしたとき・実APIモードに切り替えたときに読み込む。ログアウト・失効したら権限を閲覧者に戻す
  useEffect(() => {
    if (state.settings.dataMode !== "live") return
    if (auth.email) void refreshLive()
    else
      setState((prev) =>
        produce(prev, (draft) => {
          draft.liveStatus.me = null
          draft.liveStatus.authError = null
          draft.role = "viewer"
          draft.userName = ""
        }),
      )
  }, [state.settings.dataMode, auth.email, refreshLive])

  const dryRunNote = (platform: Platform, dryRun?: boolean | null) =>
    dryRun ? `ドライラン：${PLATFORM_LABEL[platform]} には投稿していません（記録のみ）` : undefined

  /** 問題を正本に保存する（新規は ID を GAS が採番、既存は新しい版を追記） */
  const saveLiveQuestion = async (input: SaveQuestionInput) => {
    if (!guard("問題の保存", "edit", { live: true })) return null
    const saved = await callBackend("問題の保存", (b) => b.saveQuestion(input))
    if (!saved) return null
    toast.success(`${saved.id} を保存しました（v${saved.version}）`)
    await refreshLive()
    return saved
  }

  /** Gemini で問題を作り、検査を通ったものを下書きで正本に保存する */
  const liveGenerate = async (input: GenerateQuestionsInput) => {
    if (!guard("AI問題生成", "generate", { live: true })) return null
    if (stateRef.current.settings.emergencyStop) {
      toast.error("緊急停止中のため生成できません")
      return null
    }
    const res = await callBackend("AI問題生成", (b) => b.generateQuestions(input))
    if (!res) return null
    await refreshLive()
    if (res.saved.length) toast.success(`${res.saved.length} 問を下書きで保存しました`, { description: res.rejected.length ? `${res.rejected.length} 問は検査で除外しました` : undefined })
    else toast.error("保存できる問題がありませんでした", { description: res.rejected[0]?.reason })
    return res
  }

  /** 1 問の全版（古い順）。読めなければ null */
  const loadLiveHistory = async (id: string) => callBackend("履歴の取得", (b) => b.getQuestionHistory(id))

  /** カード画像（data URL）。作れなければ null */
  const renderLiveCard = async (id: string, kind: "question" | "answer") => (await callBackend("カード画像の作成", (b) => b.renderQuizCard(id, kind)))?.dataUrl ?? null

  /** Excel・CSV から読み込んだ問題を下書きで正本に登録する（100 問ずつ送る） */
  const importLiveQuestions = async (rows: ImportQuestionInput[], fileName: string): Promise<ImportQuestionsResult | null> => {
    if (!guard("問題の取り込み", "edit", { live: true })) return null
    const all: ImportQuestionsResult = { saved: [], rejected: [] }
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
      const chunk = rows.slice(i, i + IMPORT_CHUNK)
      const res = await callBackend("問題の取り込み", (b) => b.importQuestions(chunk, fileName))
      // 途中で失敗したら、残りは送らずに未登録として返す（登録済みの分は正本に残っている）
      if (!res) {
        rows.slice(i).forEach((r) => all.rejected.push({ ref: r.ref, reason: "送信に失敗したため登録していません" }))
        break
      }
      all.saved.push(...res.saved)
      all.rejected.push(...res.rejected)
    }
    await refreshLive()
    if (all.saved.length) toast.success(`${all.saved.length} 問を下書きで登録しました`, { description: all.rejected.length ? `${all.rejected.length} 問は登録できませんでした` : undefined })
    else if (all.rejected.length) toast.error("登録できる問題がありませんでした", { description: all.rejected[0]?.reason })
    return all
  }

  /** ファクトチェック（Gemini＋Google 検索）。結果は正本の fact_checks に記録される */
  const liveVerify = async (id: string) => {
    if (!guard("ファクトチェック", ["edit", "approve"], { live: true })) return
    const q = stateRef.current.live.questions.find((x) => x.id === id)
    if (!q) return
    const res = await callBackend("ファクトチェック", (b) => b.verifyQuestion(q))
    if (!res) return
    await refreshLive()
    toast.success("ファクトチェックを実行しました", { description: `判定：${res.status === "passed" ? "検証OK" : res.status === "warning" ? "要確認" : "検証NG"}（${res.model ?? "Gemini"}）` })
  }

  // ---------------- 実APIモードのユーザーと権限 ----------------
  const requestLiveRole = async (role: Role, note: string) => {
    const res = await callBackend("権限の申請", (b) => b.requestRole(role, note))
    if (!res) return false
    setState((prev) => produce(prev, (draft) => void (draft.liveStatus.me && (draft.liveStatus.me.pendingRequest = res.pendingRequest))))
    toast.success(`${ROLE_LABEL[role]}を申請しました`, { description: "管理者が承認すると反映されます（再読み込みで確認できます）" })
    return true
  }
  const loadLiveUsers = () => callBackend("ユーザー一覧の取得", (b) => b.listUsers())
  const setLiveUserRole = async (email: string, role: Role) => {
    if (!guard("権限の変更", "users", { live: true })) return false
    const res = await callBackend("権限の変更", (b) => b.setUserRole(email, role))
    if (res) toast.success(`${email} を${ROLE_LABEL[role]}にしました`)
    return !!res
  }
  const rejectLiveRoleRequest = async (email: string) => {
    if (!guard("申請の却下", "users", { live: true })) return false
    const res = await callBackend("申請の却下", (b) => b.rejectRoleRequest(email))
    if (res) toast.success(`${email} の申請を却下しました`)
    return !!res
  }

  /** 毎朝の自動投稿（GAS の AUTOMATION_ENABLED）を止める・再開する */
  const setLiveAutomation = async (enabled: boolean) => {
    if (!guard(enabled ? "自動投稿の再開" : "自動投稿の停止", "automation", { live: true })) return
    const res = await callBackend("自動投稿の切り替え", (b) => b.setAutomationEnabled(enabled))
    if (!res) return
    toast.success(res.enabled ? "毎朝の自動投稿を再開しました" : "毎朝の自動投稿を停止しました", { description: res.enabled ? undefined : "06:00 の投稿・前日の確定は行われません。手動投稿はできます" })
    await refreshLive()
  }

  /**
   * 出題日を変える（出題計画）。承認済みの問題に日付を入れると予約、空にすると予備に戻る。
   * 承認済みのまま保存するので、GAS では承認の権限が要る
   */
  const assignLiveDate = async (id: string, date: string | null) => {
    if (!guard(date ? "出題日の割り当て" : "予備に戻す", "approve", { live: true })) return false
    const q = stateRef.current.live.questions.find((x) => x.id === id)
    if (!q) return false
    const saved = await callBackend("出題日の変更", (b) =>
      b.saveQuestion({ id, text: q.text, choices: q.choices, answer: q.answer, explanation: q.explanation, platform: q.platform, plannedDate: date, status: "approved", note: date ? `出題計画から ${date} に割り当て` : "出題計画から予備に戻す" }),
    )
    if (!saved) return false
    toast.success(date ? `${id} を ${date} に割り当てました` : `${id} を予備に戻しました`)
    await refreshLive()
    return true
  }

  /** 状態だけを変えて新しい版を保存する（承認・差し戻し・不採用） */
  const setLiveQuestionStatus = (id: string, status: SaveQuestionInput["status"], note: string) => {
    if (!guard("状態の変更", "approve", { live: true })) return false
    const q = stateRef.current.live.questions.find((x) => x.id === id)
    if (!q) return false
    // GAS でも確かめるが、先に画面で止めて理由を出す（要確認は承認できる）
    if (status === "approved" && (q.factCheck.status === "pending" || q.factCheck.status === "failed")) {
      toast.error(q.factCheck.status === "failed" ? "検証NGの問題は承認できません" : "未検証の問題は承認できません", { description: q.factCheck.status === "failed" ? "修正して再検証してください" : "先に再検証を実行してください" })
      return false
    }
    void saveLiveQuestion({ id, text: q.text, choices: q.choices, answer: q.answer, explanation: q.explanation, platform: q.platform, plannedDate: q.plannedDate, status, note })
    return true
  }

  const livePostNow = async (jobId: string) => {
    if (!guard("今すぐ投稿", "post", { live: true })) return
    const s = stateRef.current
    if (s.settings.emergencyStop) return void toast.error("緊急停止中のため投稿できません")
    const job = s.live.postJobs.find((j) => j.id === jobId)
    const q = s.live.questions.find((x) => x.id === job?.questionId)
    if (!job || !q) return
    if (job.status === "unknown") {
      return void toast.error("公開状況が不明です", { description: `二重投稿を防ぐため、${PLATFORM_LABEL[job.platform]} 上で投稿の有無を確認してください。自動では再投稿しません` })
    }
    if (q.status !== "approved") return void toast.error("承認済みの問題だけ投稿できます")
    // 予約・失敗からの投稿は、その時点の最新版（承認済み）を固定して送る
    const version = q.versions[q.versions.length - 1].version
    const res = await callBackend("投稿", (b) => b.publishPost({ ...job, questionVersion: version }, q))
    await refreshLive()
    if (res) toast.success(`${job.date} の問題を投稿しました（v${version}）`, { description: [dryRunNote(job.platform, res.dryRun), res.warning].filter(Boolean).join(" / ") || undefined })
  }

  const liveRevealAnswer = async (jobId: string) => {
    if (!guard("正解発表", "post", { live: true })) return
    const s = stateRef.current
    const job = s.live.postJobs.find((j) => j.id === jobId)
    const q = s.live.questions.find((x) => x.id === job?.questionId)
    if (!job || !q || job.status !== "posted") return
    const res = await callBackend("正解発表", (b) => b.revealAnswer(job, q).then(() => true))
    await refreshLive()
    const dry = job.platform === "discord" ? s.liveStatus.discordDryRun : s.liveStatus.dryRun
    if (res) toast.success(job.platform === "discord" ? "締め切って、正解・解説を返信で公開しました" : "正解・解説をリプライで公開しました", { description: dryRunNote(job.platform, dry) })
  }

  const liveFetchResults = async (jobId: string) => {
    if (!guard("結果の取得", "post", { live: true })) return
    const s = stateRef.current
    const job = s.live.postJobs.find((j) => j.id === jobId)
    const q = s.live.questions.find((x) => x.id === job?.questionId)
    if (!job || !q || job.status !== "posted") return
    const snap = await callBackend("結果の取得", (b) => b.fetchResponses(job, q))
    await refreshLive()
    if (snap) toast.success(`回答結果を取得しました（${snap.finalized ? "確定" : "暫定"}）`, { description: `回答数 ${snap.responses ?? "未取得"}` })
  }

  const liveCheckPostStatus = async (jobId: string) => {
    if (!guard("公開状況の確認", "post", { live: true })) return
    const job = stateRef.current.live.postJobs.find((j) => j.id === jobId)
    if (!job) return
    const res = await callBackend("公開状況の確認", (b) => b.checkPostStatus(job))
    if (!res) return
    await refreshLive()
    if (res.found) toast.success("投稿記録があります", { description: "再投稿は不要です" })
    else toast.info("成功した投稿記録はありません", { description: `成否不明の場合は ${PLATFORM_LABEL[job.platform]} 上で投稿の有無を確認してください` })
  }

  const log = (d: Draft<AppData>, action: string, target: string, href?: string, actor?: string) => {
    d.activity.unshift({ id: uid("A"), at: nowIso(), actor: actor ?? stateRef.current.userName, action, target, href })
  }
  const notify = (d: Draft<AppData>, n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    d.notifications.unshift({ ...n, id: uid("N"), createdAt: nowIso(), read: false })
  }

  // ---------------- 生成ジョブ（擬似処理） ----------------
  const finalizeJob = (d: Draft<AppData>, job: Draft<GenerationJob>, settings: SystemSettings) => {
    const createdAt = nowIso()
    let seq = nextSeq(d.questions as Question[])
    const targets = job.targetSlotIds.map((id) => d.slots.find((s) => s.id === id)).filter(Boolean) as Draft<PlanSlot>[]
    const extra = job.total - targets.length
    const items: { slot: Draft<PlanSlot> | null }[] = [...targets.map((slot) => ({ slot })), ...Array.from({ length: extra }, () => ({ slot: null }))]
    let success = 0
    let review = 0
    let rejected = 0
    const resultIds: string[] = []

    items.forEach(({ slot }, i) => {
      const pattern = (["pass", "review", "pass", "duplicate", "reject"] as const)[(seq + i) % 5]
      const outcome = pattern
      const platform: Platform = slot?.platform ?? job.options.platform ?? (job.platforms.includes("instagram") ? "instagram" : job.platforms[0] ?? "x")
      const date = slot?.date ?? (platform === "instagram" ? null : job.options.date ?? null)
      const categoryId = slot && slot.categoryId !== "auto" ? slot.categoryId : job.options.categoryId
      const candidates = GENERATION_POOL.map((p, idx) => ({ p, idx })).filter(({ p, idx }) => idx !== 7 && (categoryId === "auto" || p.categoryId === categoryId))
      const pool = candidates.length ? candidates : GENERATION_POOL.map((p, idx) => ({ p, idx })).filter(({ idx }) => idx !== 7)
      const poolIndex = outcome === "duplicate" ? 7 : pool[(seq + i) % pool.length].idx
      const q = makeGeneratedQuestion(seq + i, poolIndex, platform, date, createdAt, outcome, job.id)

      // 既存問題との同一知識チェック（デモ用の簡易判定）
      const existing = d.questions.find((o) => o.knowledgeId === q.knowledgeId && o.status !== "rejected" && o.id !== q.id)
      if (existing && outcome !== "duplicate" && outcome !== "reject") {
        const same = existing.platform === platform
        const months = same ? settings.rules.sameplatformMonths : settings.rules.crossPlatformMonths
        const reusableFrom = addMonths(existing.plannedDate ?? DEMO_TODAY, months)
        const conflict = !!date && date < reusableFrom
        q.duplicate = {
          level: conflict ? "strong" : "weak",
          reusableFrom,
          similar: [{ questionId: existing.id, knowledgeId: existing.knowledgeId, text: existing.text, reason: "同一の知識IDを持つ問題が既に存在します", similarity: 0.88, sameKnowledge: true, platform: existing.platform, postedAt: existing.plannedDate ?? DEMO_TODAY, reusableFrom }],
        }
        if (conflict) {
          q.autoApprovable = false
          q.autoApprovalBlockers = ["強い重複疑義（再出題制限内）"]
          q.factCheck.items = q.factCheck.items.map((it) => (it.key === "duplicate" ? { ...it, result: "fail", note: `${existing.id} と同一知識` } : it))
          q.factCheck.status = "warning"
        }
      }

      const auto = job.options.autoApprove && !settings.verificationMode && outcome === "pass" && q.duplicate.level !== "strong"
      if (auto) {
        q.status = "approved"
        q.confirmedVersion = 1
        q.imageStatus = "ready"
        q.imageVersion = 1
        q.reviewHistory.push({ at: createdAt, by: "条件付き自動承認", action: "auto_approved", note: "全必須条件を満たしたため自動承認" })
      } else if (settings.verificationMode && outcome === "pass") {
        q.autoApprovalBlockers = ["検証モード中（全件人間確認）"]
      }

      if (outcome === "reject") rejected++
      else if (outcome === "pass" && q.duplicate.level !== "strong") success++
      else review++

      d.questions.unshift(q)
      resultIds.push(q.id)
      if (slot) {
        if (outcome === "reject") {
          slot.status = "waiting"
          slot.questionId = null
        } else {
          slot.questionId = q.id
          slot.status = auto ? "confirmed" : "review"
        }
      }
    })

    const model = AI_MODELS.find((m) => m.id === job.model)
    job.status = "completed"
    job.finishedAt = createdAt
    job.completed = job.total
    job.success = success
    job.needsReview = review
    job.rejected = rejected
    job.resultIds = resultIds
    job.actualCostJpy = Math.round(job.total * (model?.costPerQuestion ?? 2) * 0.92 * 10) / 10
    notify(d, {
      level: review ? "warning" : "success",
      kind: "generation",
      title: `生成ジョブ ${job.id} が完了しました`,
      description: `成功${success}件・要確認${review}件・不採用${rejected}件（デモ擬似処理）`,
      href: review ? "/reviews" : "/generate",
    })
    log(d, `AI生成ジョブ完了（${job.total}件・デモ）`, job.id, "/generate", "AI生成ジョブ")
  }

  const runningJobs = data.jobs.some((j) => j.status === "running")
  useEffect(() => {
    if (!runningJobs) return
    const timer = setInterval(() => {
      setState((prev) =>
        produce(prev, (draft) => {
          const d = draft.demo
          for (const job of d.jobs) {
            if (job.status !== "running") continue
            const idx = job.steps.findIndex((s) => s.status === "running")
            if (idx === -1) continue
            const step = job.steps[idx]
            step.status = step.key === "duplicate" && job.total > 2 ? "warn" : "done"
            step.finishedAt = nowIso()
            step.result = step.key === "duplicate" && job.total > 2 ? "重複疑義あり（要確認へ回付）" : "完了"
            const done = idx + 1
            job.completed = Math.floor((job.total * done) / job.steps.length)
            if (idx + 1 < job.steps.length) {
              job.steps[idx + 1].status = "running"
              job.steps[idx + 1].startedAt = nowIso()
            } else {
              finalizeJob(d, job, draft.settings as SystemSettings)
            }
          }
        }),
      )
    }, 550)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningJobs])

  /** 生成対象を算出（確定済み・予約済みの枠は対象外＝上書きしない） */
  const planGeneration = (req: GenerationRequest) => {
    const s = stateRef.current
    const d = s.demo
    const busy = new Set(d.jobs.filter((j) => j.status === "running").flatMap((j) => j.targetSlotIds))
    const newSlots: PlanSlot[] = []
    const targetIds: string[] = []
    let extra = 0
    const isOpen = (slot: PlanSlot) => (slot.status === "waiting" || slot.status === "unset") && !slot.questionId && !busy.has(slot.id)

    const collect = (dates: string[], platforms: Platform[]) => {
      for (const date of dates) {
        for (const platform of platforms.filter((p) => p !== "instagram")) {
          const slot = d.slots.find((x) => x.date === date && x.platform === platform)
          if (slot) {
            if (isOpen(slot)) targetIds.push(slot.id)
            continue
          }
          const row = d.weeklyTemplate.find((r) => r.weekday === weekday(date) && r.platform === platform)
          if (!row?.enabled) continue
          const created: PlanSlot = { id: `SL-${date}-${platform}`, date, platform, categoryId: row.categoryId, difficulty: row.difficulty, theme: "", format: "auto", timeliness: row.timeliness, time: row.time, instructions: "", generation: row.generation, priority: "normal", status: "waiting", questionId: null, source: "template" }
          newSlots.push(created)
          targetIds.push(created.id)
        }
      }
    }

    const igStock = d.questions.filter((q) => q.platform === "instagram" && q.status === "approved").length
    if (req.mode === "daily") {
      collect(dateRange(addDays(DEMO_TODAY, 1), addDays(DEMO_TODAY, s.settings.ai.dailyLookaheadDays)), ["x", "discord"])
      extra = Math.max(0, s.settings.posting.instagramMinStock - igStock)
    } else if (req.mode === "bulk" && req.range) {
      const days = dateRange(req.range.from, req.range.to)
      collect(days, req.platforms)
      if (req.platforms.includes("instagram")) extra = Math.max(1, Math.ceil(days.length / 7))
    } else if (req.mode === "single") {
      const platform = req.options.platform ?? "x"
      let count = req.options.count
      if (req.options.date && platform !== "instagram") {
        const before = targetIds.length
        collect([req.options.date], [platform])
        count -= targetIds.length - before
      }
      extra = Math.max(0, count)
    }
    return { targetIds, newSlots, extra }
  }

  const previewGeneration = (req: GenerationRequest) => {
    const { targetIds, extra } = planGeneration(req)
    const total = targetIds.length + extra
    const model = AI_MODELS.find((m) => m.id === req.options.model) ?? AI_MODELS[0]
    return { slotCount: targetIds.length, extra, total, estimatedCostJpy: Math.round(total * model.costPerQuestion * 10) / 10 }
  }

  const startGeneration = (req: GenerationRequest) => {
    if (!guard("AI問題生成", "generate")) return null
    const s = stateRef.current
    if (s.settings.emergencyStop) {
      toast.error("緊急停止中のため生成できません")
      return null
    }
    const { targetIds, newSlots, extra } = planGeneration(req)
    const total = targetIds.length + extra
    if (total === 0) {
      toast.info("生成対象がありません", { description: "対象期間の出題枠はすべて生成済み・確定済みです（確定済み・予約済みは上書きしません）" })
      return null
    }
    const model = AI_MODELS.find((m) => m.id === req.options.model) ?? AI_MODELS[0]
    const id = `GJ-${Date.now().toString().slice(-6)}`
    const job: GenerationJob = {
      id,
      mode: req.mode,
      status: "running",
      startedAt: nowIso(),
      finishedAt: null,
      platforms: req.platforms,
      range: req.range,
      total,
      completed: 0,
      success: 0,
      needsReview: 0,
      rejected: 0,
      errors: 0,
      steps: PIPELINE_STEPS.map((p, i) => ({ ...p, status: i === 0 ? "running" : "pending", startedAt: i === 0 ? nowIso() : null, finishedAt: null })),
      model: model.id,
      estimatedCostJpy: Math.round(total * model.costPerQuestion * 10) / 10,
      actualCostJpy: null,
      resultIds: [],
      targetSlotIds: targetIds,
      options: req.options,
      isDemo: true,
    }
    update((d) => {
      d.slots.push(...newSlots)
      for (const slot of d.slots) if (targetIds.includes(slot.id)) slot.status = "generating"
      d.jobs.unshift(job)
      log(d, `AI生成ジョブを開始（${total}件）`, id, "/generate")
    })
    toast.success(label(`生成ジョブ ${id} を開始しました`), { description: `${total}件・推定費用 ¥${job.estimatedCostJpy}（実際のAPIは呼び出しません）` })
    return id
  }

  const cancelJob = (jobId: string) => {
    update((d) => {
      const job = d.jobs.find((j) => j.id === jobId)
      if (!job || job.status !== "running") return
      job.status = "cancelled"
      job.finishedAt = nowIso()
      for (const slot of d.slots) if (job.targetSlotIds.includes(slot.id) && slot.status === "generating") slot.status = "waiting"
      log(d, "生成ジョブを中止", jobId, "/generate")
    })
    toast.info("生成ジョブを中止しました", { description: "対象の出題枠は「生成待ち」に戻りました" })
  }

  // ---------------- 出題計画 ----------------
  const upsertSlot = (slot: PlanSlot) => {
    if (!guard("出題枠の保存", "plan")) return false
    const s = stateRef.current.demo
    const clash = s.slots.find((x) => x.date === slot.date && x.platform === slot.platform && x.id !== slot.id)
    if (clash) {
      toast.error("同じ日付・媒体の出題枠が既にあります", { description: `${slot.date} ${PLATFORM_LABEL[slot.platform]}` })
      return false
    }
    update((d) => {
      const idx = d.slots.findIndex((x) => x.id === slot.id)
      if (idx >= 0) d.slots[idx] = slot
      else d.slots.push(slot)
      log(d, idx >= 0 ? "出題枠を更新" : "出題枠を追加", `${slot.date} ${PLATFORM_LABEL[slot.platform]}`, "/calendar")
    })
    toast.success(label("出題枠を保存しました"))
    return true
  }

  const cancelSlot = (slotId: string) => {
    if (!guard("出題予定の取消", "plan")) return
    const slot = stateRef.current.demo.slots.find((x) => x.id === slotId)
    if (!slot) return
    if (["posted", "aggregated", "failed"].includes(slot.status)) {
      toast.error("投稿済み（または投稿処理済み）の枠は取り消せません")
      return
    }
    update((d) => {
      const job = d.postJobs.find((j) => j.questionId === slot.questionId && j.status === "scheduled")
      if (job) job.status = "cancelled"
      const q = d.questions.find((x) => x.id === slot.questionId)
      if (q) {
        q.plannedDate = null
        if (q.status === "scheduled") q.status = "approved"
      }
      d.slots = d.slots.filter((x) => x.id !== slotId)
      log(d, "出題予定を取消", `${slot.date} ${PLATFORM_LABEL[slot.platform]}`, "/calendar")
    })
    toast.success(label("出題予定を取り消しました"), { description: slot.questionId ? `${slot.questionId} は未割当の確定問題に戻りました` : undefined })
  }

  const moveSlot = (slotId: string, toDate: string) => {
    if (!guard("予定の移動", "plan")) return false
    const s = stateRef.current
    const slot = s.demo.slots.find((x) => x.id === slotId)
    if (!slot || slot.date === toDate) return false
    if (["posted", "aggregated", "failed"].includes(slot.status)) {
      toast.error("投稿済みの枠は移動できません")
      return false
    }
    if (toDate <= DEMO_TODAY) {
      toast.error("当日以前の日付へは移動できません")
      return false
    }
    const target = s.demo.slots.find((x) => x.date === toDate && x.platform === slot.platform)
    if (target && (target.questionId || !["waiting", "unset"].includes(target.status))) {
      toast.error("移動先に問題が割り当て済みの枠があります", { description: "確定済みの予定は上書きしません" })
      return false
    }
    const q = s.demo.questions.find((x) => x.id === slot.questionId)
    const warnings: string[] = []
    if (q) {
      const reuse = checkReuse(q, slot.platform, toDate, s.demo.questions, s.settings.rules)
      if (!reuse.ok) {
        toast.error("再出題制限に抵触するため移動できません", { description: describeConflict(reuse.conflicts[0]) })
        return false
      }
      if (q.imageStatus !== "ready" && ["confirmed", "scheduled"].includes(slot.status)) warnings.push("画像が確定版と一致していません。画像を再生成してください")
      if (q.timeliness === "current") warnings.push("時事問題のため、出題日変更に伴い出典の有効性を再確認してください")
    }
    update((d) => {
      if (target) d.slots = d.slots.filter((x) => x.id !== target.id)
      const sl = d.slots.find((x) => x.id === slotId)!
      sl.date = toDate
      sl.id = `SL-${toDate}-${sl.platform}`
      const qq = d.questions.find((x) => x.id === sl.questionId)
      if (qq) qq.plannedDate = toDate
      const job = d.postJobs.find((j) => j.questionId === sl.questionId && j.status === "scheduled")
      if (job) {
        job.date = toDate
        job.scheduledAt = jstIso(toDate, sl.time)
        job.id = `PJ-${toDate.replaceAll("-", "")}-${sl.platform === "x" ? "X" : "DC"}`
      }
      log(d, `予定を移動（→${toDate}）`, `${slot.date} ${PLATFORM_LABEL[slot.platform]}`, "/calendar")
    })
    toast.success(label(`予定を${toDate}へ移動しました`), { description: warnings.length ? warnings.join(" / ") : "重複期間・出典・版の整合性を再確認しました（デモ判定）" })
    return true
  }

  const copySlotTo = (slotId: string, dates: string[]) => {
    if (!guard("出題枠の複製", "plan")) return
    const s = stateRef.current.demo
    const src = s.slots.find((x) => x.id === slotId)
    if (!src) return
    let applied = 0
    let skipped = 0
    update((d) => {
      for (const date of dates) {
        const existing = d.slots.find((x) => x.date === date && x.platform === src.platform)
        if (existing && (existing.questionId || !["waiting", "unset"].includes(existing.status))) {
          skipped++
          continue
        }
        const copy: PlanSlot = { ...src, id: `SL-${date}-${src.platform}`, date, status: "waiting", questionId: null, source: "manual" }
        if (existing) Object.assign(existing, copy)
        else d.slots.push(copy)
        applied++
      }
      log(d, `出題条件を${applied}日へ複製`, `${src.date} ${PLATFORM_LABEL[src.platform]}`, "/calendar")
    })
    toast.success(label(`${applied}件に複製しました`), { description: skipped ? `${skipped}件は確定済みのため上書きしませんでした` : undefined })
  }

  const bulkSetSlots = (dates: string[], platforms: Platform[], patch: Partial<PlanSlot>) => {
    if (!guard("一括設定", "plan")) return
    let applied = 0
    let skipped = 0
    update((d) => {
      for (const date of dates) {
        for (const platform of platforms) {
          const existing = d.slots.find((x) => x.date === date && x.platform === platform)
          if (existing) {
            if (existing.questionId || !["waiting", "unset"].includes(existing.status)) {
              skipped++
              continue
            }
            Object.assign(existing, patch, { source: "manual" })
          } else {
            d.slots.push({ id: `SL-${date}-${platform}`, date, platform, categoryId: "auto", difficulty: "auto", theme: "", format: "auto", timeliness: "auto", time: "06:00", instructions: "", generation: "auto", priority: "normal", status: "waiting", questionId: null, source: "manual", ...patch })
          }
          applied++
        }
      }
      log(d, `出題枠を一括設定（${applied}件）`, `${dates[0]}〜${dates.at(-1)}`, "/calendar")
    })
    toast.success(label(`${applied}件の出題枠を設定しました`), { description: skipped ? `${skipped}件は確定済み・予約済みのため変更していません` : undefined })
  }

  const applyTemplate = (from: string, to: string) => {
    if (!guard("テンプレート適用", "plan")) return
    let created = 0
    let updated = 0
    let skipped = 0
    update((d) => {
      for (const date of dateRange(from, to)) {
        for (const row of d.weeklyTemplate.filter((r) => r.weekday === weekday(date) && r.enabled)) {
          const existing = d.slots.find((x) => x.date === date && x.platform === row.platform)
          const patch = { categoryId: row.categoryId, difficulty: row.difficulty, timeliness: row.timeliness, generation: row.generation, time: row.time, source: "template" as const }
          if (!existing) {
            d.slots.push({ id: `SL-${date}-${row.platform}`, date, platform: row.platform, theme: "", format: "auto", instructions: "", priority: "normal", status: "waiting", questionId: null, ...patch })
            created++
          } else if (existing.source === "manual" || existing.questionId || !["waiting", "unset"].includes(existing.status)) {
            skipped++
          } else {
            Object.assign(existing, patch)
            updated++
          }
        }
      }
      log(d, `週間テンプレートを適用（新規${created}・更新${updated}）`, `${from}〜${to}`, "/calendar")
    })
    toast.success(label("週間テンプレートを適用しました"), { description: `新規${created}件・更新${updated}件・個別指定/確定済みのため維持${skipped}件` })
  }

  const updateTemplateRow = (weekdayIdx: number, platform: Platform, patch: Partial<WeeklyTemplateRow>) => {
    if (!can(stateRef.current.role, "plan")) {
      toast.error("権限がありません")
      return
    }
    update((d) => {
      const row = d.weeklyTemplate.find((r) => r.weekday === weekdayIdx && r.platform === platform)
      if (row) Object.assign(row, patch)
    })
  }

  const assignQuestion = (slotId: string, questionId: string) => {
    if (!guard("問題の割り当て", "plan")) return false
    const s = stateRef.current
    const slot = s.demo.slots.find((x) => x.id === slotId)
    const q = s.demo.questions.find((x) => x.id === questionId)
    if (!slot || !q) return false
    if (q.platform !== slot.platform) {
      toast.error("媒体が異なります", { description: `${q.id} は${PLATFORM_LABEL[q.platform]}向けに最適化されています。媒体別の版を作成してください` })
      return false
    }
    const reuse = checkReuse(q, slot.platform, slot.date, s.demo.questions, s.settings.rules)
    if (!reuse.ok) {
      toast.error("再出題制限に抵触します", { description: describeConflict(reuse.conflicts[0]) })
      return false
    }
    update((d) => {
      const sl = d.slots.find((x) => x.id === slotId)!
      const prev = d.questions.find((x) => x.id === sl.questionId)
      if (prev && prev.status !== "posted") prev.plannedDate = null
      sl.questionId = questionId
      const qq = d.questions.find((x) => x.id === questionId)!
      qq.plannedDate = sl.date
      sl.status = qq.status === "approved" ? "confirmed" : qq.status === "review" ? "review" : sl.status
      log(d, "既存問題を出題枠へ割り当て", `${questionId} → ${sl.date}`, questionHref(questionId))
    })
    toast.success(label(`${questionId} を ${slot.date} に割り当てました`))
    return true
  }

  // ---------------- 問題 ----------------
  const editQuestion = (id: string, draft: { text: string; choices: string[]; answer: ChoiceLabel; explanation: string; categoryId?: string; difficulty?: Question["difficulty"] }, note: string) => {
    if (!guard("問題の編集", "edit")) return false
    let unscheduled = false
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (!q) return
      const choices = draft.choices.map((text, i) => ({ label: (["A", "B", "C"] as ChoiceLabel[])[i], text }))
      const snapshot = { text: draft.text, choices, answer: draft.answer, explanation: draft.explanation }
      const version = q.versions.length + 1
      q.versions.push({ version, hash: shortHash(JSON.stringify(snapshot)), createdAt: nowIso(), author: stateRef.current.userName, summary: note || "手動修正", snapshot })
      q.text = draft.text
      q.choices = choices
      q.answer = draft.answer
      q.explanation = draft.explanation
      if (draft.categoryId) q.categoryId = draft.categoryId
      if (draft.difficulty) q.difficulty = draft.difficulty
      q.updatedAt = nowIso()
      // 修正後は既存の検証結果を引き継がない
      q.factCheck = { status: "pending", items: q.factCheck.items.map((i) => ({ key: i.key, label: i.label, result: "pending" })), concerns: ["修正されたため再検証が必要です"], checkedAt: null, model: null }
      if (q.imageStatus === "ready") q.imageStatus = "stale"
      if (["approved", "scheduled", "returned"].includes(q.status)) q.status = "review"
      q.reviewHistory.push({ at: nowIso(), by: stateRef.current.userName, action: "edited", note: note || `v${version} を作成` })
      for (const job of d.postJobs) {
        if (job.questionId === id && job.status === "scheduled") {
          job.status = "draft"
          unscheduled = true
        }
      }
      const slot = d.slots.find((x) => x.questionId === id)
      if (slot && ["confirmed", "scheduled"].includes(slot.status)) slot.status = "review"
      log(d, `問題を修正（v${version}）`, id, questionHref(id))
    })
    toast.success(label("修正を保存しました"), { description: unscheduled ? "投稿予約を解除し、再検証待ちにしました。旧画像は無効化されました" : "再検証が必要です。旧画像は無効化されました" })
    return true
  }

  const reverify = async (id: string) => {
    if (!isDemo()) return liveVerify(id)
    if (!guard("再検証", ["edit", "approve"])) return
    const q = stateRef.current.demo.questions.find((x) => x.id === id)
    if (!q) return
    update((d) => {
      const qq = d.questions.find((x) => x.id === id)
      if (qq) qq.factCheck.status = "running"
    })
    const result = await callBackend("再検証", (b) => b.verifyQuestion(q))
    update((d) => {
      const qq = d.questions.find((x) => x.id === id)
      if (!qq) return
      if (!result) {
        qq.factCheck.status = "pending"
        return
      }
      qq.factCheck = result
      qq.autoApprovable = result.status === "passed" && qq.duplicate.level !== "strong"
      qq.reviewHistory.push({ at: nowIso(), by: "検証エンジン（デモ）", action: "reverified", note: result.status })
      log(d, "検証を再実行", id, questionHref(id))
    })
    if (result) toast.success(label("検証を再実行しました"), { description: `判定：${result.status === "passed" ? "検証OK" : result.status === "warning" ? "要確認" : "検証NG"}（擬似判定）` })
  }

  const generateImage = (id: string) => {
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (q) q.imageStatus = "generating"
    })
    setTimeout(() => {
      update((d) => {
        const q = d.questions.find((x) => x.id === id)
        if (!q) return
        q.imageStatus = "ready"
        q.imageVersion = q.confirmedVersion ?? q.versions.length
      })
    }, 1200)
  }

  const regenerateImage = (id: string) => {
    if (!guard("画像再生成", ["edit", "approve"])) return
    const q = stateRef.current.demo.questions.find((x) => x.id === id)
    if (!q?.confirmedVersion || q.status === "review") {
      toast.error("確定版がないため画像を生成できません", { description: "画像は必ず確定版の問題データから生成します" })
      return
    }
    generateImage(id)
    toast.success(label("確定版から画像を再生成しています"))
  }

  const approve = (id: string, note = "") => {
    if (!isDemo()) return setLiveQuestionStatus(id, "approved", note || "承認")
    if (!guard("承認", "approve")) return false
    const q = stateRef.current.demo.questions.find((x) => x.id === id)
    if (!q) return false
    if (q.factCheck.status === "pending" || q.factCheck.status === "running") {
      toast.error("未検証の問題は承認できません", { description: "先に再検証を実行してください" })
      return false
    }
    if (q.factCheck.status === "failed") {
      toast.error("検証NGの問題は承認できません", { description: "修正して再検証してください" })
      return false
    }
    update((d) => {
      const qq = d.questions.find((x) => x.id === id)!
      qq.status = "approved"
      qq.confirmedVersion = qq.versions.length
      qq.reviewHistory.push({ at: nowIso(), by: stateRef.current.userName, action: "approved", note: note || undefined })
      const slot = d.slots.find((x) => x.questionId === id)
      if (slot) slot.status = "confirmed"
      log(d, `問題を承認（確定版 v${qq.confirmedVersion}）`, id, questionHref(id))
    })
    generateImage(id)
    toast.success(label(`${id} を承認しました`), { description: "確定版から投稿画像を生成しています" })
    return true
  }

  const returnQuestion = (id: string, note: string) => {
    if (!isDemo()) return void setLiveQuestionStatus(id, "returned", note)
    if (!guard("差し戻し", "approve")) return
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (!q) return
      q.status = "returned"
      q.reviewHistory.push({ at: nowIso(), by: stateRef.current.userName, action: "returned", note })
      const slot = d.slots.find((x) => x.questionId === id)
      if (slot) slot.status = "review"
      log(d, "問題を差し戻し", id, questionHref(id))
    })
    toast.success(label(`${id} を差し戻しました`))
  }

  const rejectQuestion = (id: string, note: string) => {
    if (!isDemo()) return void setLiveQuestionStatus(id, "rejected", note)
    if (!guard("不採用", ["approve", "edit"])) return
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (!q) return
      q.status = "rejected"
      q.reviewHistory.push({ at: nowIso(), by: stateRef.current.userName, action: "rejected", note })
      const slot = d.slots.find((x) => x.questionId === id)
      if (slot) {
        slot.status = "waiting"
        slot.questionId = null
      }
      q.plannedDate = null
      log(d, "問題を不採用", id, questionHref(id))
    })
    toast.success(label(`${id} を不採用にしました`), { description: "出題枠は「生成待ち」に戻りました" })
  }

  const regenerateQuestion = async (id: string) => {
    if (!isDemo()) {
      // Gemini で同じ媒体・出題日の問題を 1 問作り、できたら元の問題を不採用にする
      if (!guard("別問題を生成", "generate", { live: true })) return
      const q = stateRef.current.live.questions.find((x) => x.id === id)
      if (!q || q.platform === "instagram") return
      if (["scheduled", "posted", "archived"].includes(q.status) || q.history.some((h) => h.status === "posted")) return void toast.error("投稿済みの問題は作り直せません")
      const res = await callBackend("別問題を生成", (b) => b.generateQuestions({ platform: q.platform as "x" | "discord", count: 1, plannedDate: q.plannedDate ?? undefined, instructions: `次の問題とは別の内容にすること：${q.text.slice(0, 80)}` }))
      if (!res) return
      if (!res.saved.length) return void toast.error("別の問題を作れませんでした", { description: res.rejected[0]?.reason })
      // 不採用にするには承認の権限が要る（GAS も確かめる）。無ければ元の問題はそのまま残す
      const canReject = can(stateRef.current.role, "approve")
      if (canReject) {
        await callBackend("不採用", (b) =>
          b.saveQuestion({ id, text: q.text, choices: q.choices, answer: q.answer, explanation: q.explanation, platform: q.platform, plannedDate: null, status: "rejected", note: `別問題（${res.saved[0].id}）を生成したため` }),
        )
      }
      await refreshLive()
      toast.success(`${res.saved[0].id} を下書きで作りました`, { description: canReject ? `${id} は不採用にしました` : `${id} の不採用は承認者・管理者が行ってください` })
      return
    }
    if (!guard("再生成", "generate")) return
    const s = stateRef.current
    const q = s.demo.questions.find((x) => x.id === id)
    if (!q) return
    if (["scheduled", "posted", "archived"].includes(q.status)) {
      toast.error("予約済み・出題済みの問題は再生成できません")
      return
    }
    const slot = s.demo.slots.find((x) => x.questionId === id)
    update((d) => {
      const qq = d.questions.find((x) => x.id === id)!
      qq.status = "rejected"
      qq.reviewHistory.push({ at: nowIso(), by: s.userName, action: "rejected", note: "別問題を再生成するため" })
      const sl = d.slots.find((x) => x.questionId === id)
      if (sl) {
        sl.status = "waiting"
        sl.questionId = null
      }
    })
    startGeneration({
      mode: "single",
      platforms: [q.platform],
      range: null,
      options: { count: 1, categoryId: q.categoryId, difficulty: q.difficulty, theme: "", usePlan: true, usePastAnalysis: true, excludeGenerated: true, autoApprove: false, model: s.settings.ai.defaultModel, instructions: `「${q.knowledgeId}」とは別の知識で生成`, platform: q.platform, date: slot?.date ?? q.plannedDate ?? undefined },
    })
  }

  /** 実APIモード：同じ内容を新しい問題（下書き・出題日なし）として正本に保存し、新しい ID を返す */
  const liveDuplicateQuestion = async (id: string) => {
    const q = stateRef.current.live.questions.find((x) => x.id === id)
    if (!q) return null
    const saved = await saveLiveQuestion({
      text: q.text,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      platform: q.platform,
      plannedDate: null,
      status: "draft",
      note: `${id} から複製`,
    })
    return saved?.id ?? null
  }

  const duplicateQuestion = (id: string): string | null | Promise<string | null> => {
    if (!isDemo()) return liveDuplicateQuestion(id)
    if (!guard("複製", "edit")) return null
    const s = stateRef.current
    const q = s.demo.questions.find((x) => x.id === id)
    if (!q) return null
    const newId = `Q-2026-${String(nextSeq(s.demo.questions)).padStart(4, "0")}`
    update((d) => {
      const copy: Question = clone(q)
      copy.id = newId
      copy.status = "draft"
      copy.plannedDate = null
      copy.history = []
      copy.responses = []
      copy.confirmedVersion = null
      copy.imageStatus = "none"
      copy.imageVersion = null
      copy.factCheck = { ...copy.factCheck, status: "pending", items: copy.factCheck.items.map((i) => ({ key: i.key, label: i.label, result: "pending" })), checkedAt: null, model: null }
      copy.reviewHistory = [{ at: nowIso(), by: s.userName, action: "edited", note: `${id} から複製` }]
      copy.createdAt = nowIso()
      copy.versions = [{ ...copy.versions.at(-1)!, version: 1, createdAt: nowIso(), author: s.userName, summary: `${id} から複製` }]
      copy.certification = "none"
      d.questions.unshift(copy)
      log(d, "問題を複製", `${id} → ${newId}`, questionHref(newId))
    })
    toast.success(label(`${newId} として複製しました`), { description: "下書き・未検証の状態です" })
    return newId
  }

  const setCertification = (id: string, status: CertificationStatus) => {
    if (!guard("検定ステータス変更", ["edit", "approve"])) return
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (q) q.certification = status
      log(d, `検定ステータスを変更（${status}）`, id, questionHref(id))
    })
    toast.success(label("検定ステータスを更新しました"))
  }

  const submitForReview = (id: string) => {
    if (!isDemo()) {
      const q = stateRef.current.live.questions.find((x) => x.id === id)
      if (q && ["draft", "returned"].includes(q.status)) {
        void saveLiveQuestion({ id, text: q.text, choices: q.choices, answer: q.answer, explanation: q.explanation, platform: q.platform, plannedDate: q.plannedDate, status: "review", note: "確認依頼" })
      }
      return
    }
    if (!guard("確認依頼", "edit")) return
    update((d) => {
      const q = d.questions.find((x) => x.id === id)
      if (q && ["draft", "returned"].includes(q.status)) q.status = "review"
    })
    toast.success(label("確認・承認待ちに回しました"))
  }

  // ---------------- 投稿 ----------------
  const schedulePost = (questionId: string) => {
    if (!isDemo()) {
      toast.info("出題日を設定してください", { description: "実APIモードでは、承認済みで出題日がある X の問題が自動で予約一覧に並びます" })
      return false
    }
    if (!guard("投稿予約", "post")) return false
    const s = stateRef.current
    const q = s.demo.questions.find((x) => x.id === questionId)
    if (!q) return false
    const check = canSchedule(q)
    if (!check.ok) {
      toast.error("投稿予約できません", { description: check.reasons.join(" / ") })
      return false
    }
    if (s.demo.postJobs.some((j) => j.questionId === questionId && ["scheduled", "posting", "posted", "unknown"].includes(j.status))) {
      toast.error("この問題には有効な投稿予約・投稿が既にあります（二重投稿防止）")
      return false
    }
    const slot = s.demo.slots.find((x) => x.questionId === questionId)
    const time = slot?.time ?? s.settings.posting.defaultTime
    const date = q.plannedDate!
    update((d) => {
      const id = `PJ-${date.replaceAll("-", "")}-${q.platform === "x" ? "X" : "DC"}`
      d.postJobs = d.postJobs.filter((j) => !(j.id === id && ["cancelled", "draft"].includes(j.status)))
      d.postJobs.push({ id, questionId, questionVersion: q.confirmedVersion!, platform: q.platform, date, scheduledAt: jstIso(date, time), publishedAt: null, status: "scheduled", url: null, externalId: null, responseStatus: "not_started", answerRevealed: false, error: null, syncStatus: "unsynced" })
      const qq = d.questions.find((x) => x.id === questionId)!
      qq.status = "scheduled"
      qq.reviewHistory.push({ at: nowIso(), by: s.userName, action: "scheduled", note: `${date} ${time}` })
      const sl = d.slots.find((x) => x.questionId === questionId)
      if (sl) sl.status = "scheduled"
      log(d, `投稿を予約（${date} ${time}）`, questionId, "/posts")
    })
    toast.success(label(`${date} ${time} に投稿予約しました`), { description: "デモでは実際には投稿されません" })
    return true
  }

  const postNow = async (jobId: string) => {
    if (!isDemo()) return livePostNow(jobId)
    if (!guard("今すぐ投稿", "post")) return
    const s = stateRef.current
    if (s.settings.emergencyStop) {
      toast.error("緊急停止中のため投稿できません")
      return
    }
    const job = s.demo.postJobs.find((j) => j.id === jobId)
    const q = s.demo.questions.find((x) => x.id === job?.questionId)
    if (!job || !q) return
    if (job.status === "unknown") {
      toast.error("公開状況が不明です", { description: "二重投稿を防ぐため、先に「公開状況を確認」を実行してください" })
      return
    }
    if (q.factCheck.status === "pending" || q.factCheck.status === "failed" || q.imageStatus !== "ready") {
      toast.error("未検証または画像が旧版の問題は投稿しません")
      return
    }
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      j.status = "posting"
    })
    const res = await callBackend("投稿", (b) => b.publishPost(job, q))
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      if (!res) {
        j.status = "failed"
        j.error = "投稿処理に失敗しました"
        return
      }
      j.status = "posted"
      j.publishedAt = res.publishedAt
      j.url = res.url
      j.externalId = res.externalId
      j.error = null
      j.responseStatus = "collecting"
      const qq = d.questions.find((x) => x.id === j.questionId)!
      qq.status = "posted"
      qq.history = qq.history.filter((h) => h.postJobId !== jobId)
      qq.history.push({ postJobId: jobId, platform: j.platform, publishedAt: j.publishedAt, externalId: j.externalId, url: j.url, status: "posted", version: j.questionVersion })
      if (!qq.responses.some((r) => r.postJobId === jobId)) {
        qq.responses.push({ platform: j.platform, postJobId: jobId, responses: null, correct: null, perChoice: { A: null, B: null, C: null }, impressions: null, clicks: null, finalized: false, collectedAt: null })
      }
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (sl) sl.status = "posted"
      log(d, "クイズを投稿（デモ擬似処理）", `${PLATFORM_LABEL[j.platform]} / ${j.questionId}`, "/posts")
    })
    if (res) toast.success(label("投稿処理を完了しました"), { description: "擬似処理です。実際のX・Discordには投稿していません" })
  }

  const checkPostStatus = async (jobId: string) => {
    if (!isDemo()) return liveCheckPostStatus(jobId)
    if (!guard("公開状況の確認", "post")) return
    const job = stateRef.current.demo.postJobs.find((j) => j.id === jobId)
    if (!job) return
    const res = await callBackend("公開状況の確認", (b) => b.checkPostStatus(job))
    if (!res) return
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      const q = d.questions.find((x) => x.id === j.questionId)!
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (res.found) {
        j.status = "posted"
        j.url = res.url
        j.externalId = res.externalId
        j.publishedAt = j.scheduledAt
        j.error = null
        j.responseStatus = "collecting"
        q.status = "posted"
        const h = q.history.find((x) => x.postJobId === jobId)
        if (h) Object.assign(h, { status: "posted", url: res.url, externalId: res.externalId, publishedAt: j.publishedAt })
        if (sl) sl.status = "posted"
      } else {
        j.status = "failed"
        j.error = "投稿は公開されていませんでした。再投稿できます"
      }
      log(d, res.found ? "公開を確認（投稿済みと判定）" : "未公開を確認", jobId, "/posts")
    })
    toast.success(label(res.found ? "投稿は公開されていました" : "投稿は公開されていませんでした"), { description: res.found ? "再投稿は不要です。回答受付中に変更しました" : "再投稿が可能です" })
  }

  const revealAnswer = async (jobId: string) => {
    if (!isDemo()) return liveRevealAnswer(jobId)
    if (!guard("正解発表", "post")) return
    const job = stateRef.current.demo.postJobs.find((j) => j.id === jobId)
    const q = stateRef.current.demo.questions.find((x) => x.id === job?.questionId)
    if (!job || !q || job.status !== "posted") return
    const ok = await callBackend("正解発表", (b) => b.revealAnswer(job, q))
    if (ok === null) return
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      j.answerRevealed = true
      log(d, "正解・解説を公開（デモ）", jobId, "/posts")
    })
    toast.success(label("正解・解説を公開しました"))
  }

  const syncSheets = async (jobIds?: string[]) => {
    if (!guard("Sheets同期", ["post", "settings"])) return
    const targets = stateRef.current.demo.postJobs.filter((j) => j.responseStatus === "finalized" && (jobIds ? jobIds.includes(j.id) : ["unsynced", "failed", "needs_check"].includes(j.syncStatus)))
    if (!targets.length) {
      toast.info("同期対象がありません", { description: "確定値の集計データのみ同期します（暫定値は同期しません）" })
      return
    }
    update((d) => {
      for (const j of d.postJobs) if (targets.some((t) => t.id === j.id)) j.syncStatus = "syncing"
    })
    const res = await callBackend("Sheets同期", (b) => b.syncToSheets(targets))
    update((d) => {
      for (const j of d.postJobs) if (targets.some((t) => t.id === j.id)) j.syncStatus = res ? "synced" : "failed"
      d.syncLogs.unshift({ id: uid("SY"), at: nowIso(), target: stateRef.current.settings.sheets.targetTab, rows: targets.length, status: res ? "synced" : "failed", message: res ? `${targets.map((t) => t.questionId).join(", ")}（デモ擬似同期）` : "同期に失敗" })
    })
    if (res) toast.success(label(`${res.rows}行をSheetsへ同期しました`), { description: "擬似処理です。既存KPIタブは変更しません" })
  }

  const fetchResults = async (jobId: string) => {
    if (!isDemo()) return liveFetchResults(jobId)
    if (!guard("結果の取得", "post")) return
    const job = stateRef.current.demo.postJobs.find((j) => j.id === jobId)
    const q = stateRef.current.demo.questions.find((x) => x.id === job?.questionId)
    if (!job || !q || job.status !== "posted") return
    const snap = await callBackend("結果の取得", (b) => b.fetchResponses(job, q))
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      if (!snap) {
        j.responseStatus = "failed"
        return
      }
      j.responseStatus = "finalized"
      j.syncStatus = "unsynced"
      const qq = d.questions.find((x) => x.id === j.questionId)!
      qq.responses = qq.responses.filter((r) => r.postJobId !== jobId)
      qq.responses.push(snap)
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (sl) sl.status = "aggregated"
      log(d, "回答結果を取得（確定値・デモ）", jobId, questionHref(j.questionId))
    })
    if (snap) {
      toast.success(label("回答結果を取得しました"), { description: `回答数 ${snap.responses}（擬似データ）` })
      if (stateRef.current.settings.sheets.autoSync) setTimeout(() => syncSheets([jobId]), 300)
    }
  }

  const switchToManual = (jobId: string) => {
    if (!guard("手動対応への切替", "post")) return
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)
      if (!j) return
      j.status = "manual"
      log(d, "手動投稿へ切替", jobId, "/posts")
    })
    toast.success(label("手動対応に切り替えました"), { description: "投稿パッケージをコ��ーして手動で投稿し、URLを記録してください" })
  }

  const markManualPosted = async (jobId: string, url: string) => {
    if (!isDemo()) {
      // 手動で投稿した URL を正本に「投稿済み」として記録する。以後の正解発表・結果取得はこの投稿に対して行う
      if (!guard("手動投稿の記録", "post", { live: true })) return
      const s = stateRef.current
      const job = s.live.postJobs.find((j) => j.id === jobId)
      const q = s.live.questions.find((x) => x.id === job?.questionId)
      if (!job || !q) return
      const version = job.status === "unknown" || job.status === "failed" ? job.questionVersion : q.versions[q.versions.length - 1].version
      const res = await callBackend("手動投稿の記録", (b) => b.recordManualPost({ ...job, questionVersion: version }, url))
      await refreshLive()
      if (res) toast.success(`${job.date} の手動投稿を記録しました（v${version}）`, { description: "正解発表・結果の取得はこの投稿に対して行います" })
      return
    }
    if (!guard("手動投稿の記録", "post")) return
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)
      if (!j) return
      j.status = "posted"
      j.url = url || null
      j.publishedAt = nowIso()
      j.error = null
      j.responseStatus = "not_started"
      const q = d.questions.find((x) => x.id === j.questionId)!
      q.status = "posted"
      q.history = q.history.filter((h) => h.postJobId !== jobId)
      q.history.push({ postJobId: jobId, platform: j.platform, publishedAt: j.publishedAt, externalId: null, url: j.url, status: "posted", version: j.questionVersion })
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (sl) sl.status = "posted"
      log(d, "手動投稿を記録", jobId, "/posts")
    })
    toast.success(label("手動投稿を記録しました"))
  }

  const cancelPost = (jobId: string) => {
    if (!guard("投稿取消", "post")) return
    const job = stateRef.current.demo.postJobs.find((j) => j.id === jobId)
    if (!job || !["scheduled", "draft", "manual", "failed"].includes(job.status)) {
      toast.error("この投稿は取り消せません")
      return
    }
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)!
      j.status = "cancelled"
      const q = d.questions.find((x) => x.id === j.questionId)
      if (q && q.status === "scheduled") q.status = "approved"
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (sl && ["scheduled", "failed"].includes(sl.status)) sl.status = "confirmed"
      log(d, "投稿予約を取消", jobId, "/posts")
    })
    toast.success(label("投稿予約を取り消しました"))
  }

  const reschedulePost = (jobId: string, time: string) => {
    if (!guard("予約変更", "post")) return
    update((d) => {
      const j = d.postJobs.find((x) => x.id === jobId)
      if (!j || j.status !== "scheduled") return
      j.scheduledAt = jstIso(j.date, time)
      const sl = d.slots.find((x) => x.questionId === j.questionId)
      if (sl) sl.time = time
      log(d, `予約時刻を変更（${time}）`, jobId, "/posts")
    })
    toast.success(label(`投稿時刻を${time}に変更しました`))
  }

  const recordInstagramPost = (questionId: string, url: string) => {
    if (!guard("Instagram投稿の記録", "post")) return
    update((d) => {
      const q = d.questions.find((x) => x.id === questionId)
      if (!q) return
      const id = `PJ-${DEMO_TODAY.replaceAll("-", "")}-IG-${q.id.slice(-4)}`
      d.postJobs.push({ id, questionId, questionVersion: q.confirmedVersion ?? 1, platform: "instagram", date: DEMO_TODAY, scheduledAt: nowIso(), publishedAt: nowIso(), status: "posted", url: url || null, externalId: null, responseStatus: "not_started", answerRevealed: false, error: null, syncStatus: "unsynced" })
      q.status = "posted"
      q.plannedDate = DEMO_TODAY
      q.history.push({ postJobId: id, platform: "instagram", publishedAt: nowIso(), externalId: null, url: url || null, status: "posted", version: q.confirmedVersion ?? 1 })
      log(d, "Instagram投稿を記録（手動）", questionId, questionHref(questionId))
    })
    toast.success(label("Instagramの出題履歴を記録しました"))
  }

  // ---------------- 分析 ----------------
  /** 実APIモード：過去の分析を正本から読む */
  const loadLiveInsights = useCallback(async () => {
    const list = await callBackend("分析履歴の取得", (b) => b.listInsights())
    if (list) setState((prev) => produce(prev, (draft) => void (draft.live.insights = list)))
  }, [callBackend])

  const runInsight = async (scope: AIInsight["scope"], targetLabel: string, questionIds: string[], model: string) => {
    if (!isDemo()) {
      // Gemini で分析し、正本の insights タブに記録する（モデルは GAS の設定）
      if (!guard("AI定性分析", "analyze", { live: true })) return null
      const res = await callBackend("AI定性分析", (b) => b.runInsight({ scope, targetLabel, questionIds, model }))
      if (!res?.id) return null
      await loadLiveInsights()
      toast.success("分析が完了しました", { description: "結果は出題ルールへ自動反映されません" })
      return res.id
    }
    if (!guard("AI定性分析", "analyze")) return null
    const id = `AI-${Date.now().toString().slice(-6)}`
    update((d) => {
      d.insights.unshift({ id, scope, targetLabel, createdAt: nowIso(), model, status: "running", facts: [], hypotheses: [], improvements: [], verification: [], cautions: [], isDemo: true })
    })
    const res = await callBackend("AI定性分析", (b) => b.runInsight({ scope, targetLabel, questionIds, model }))
    update((d) => {
      const ins = d.insights.find((x) => x.id === id)
      if (!ins) return
      if (!res) {
        ins.status = "failed"
        return
      }
      Object.assign(ins, res, { status: "completed" })
      log(d, "AI定性分析を実行（デモ）", targetLabel, "/analytics")
    })
    if (res) toast.success(label("分析が完了しました"), { description: "擬似分析です。出題ルールへは自動反映されません" })
    return id
  }

  const approveInsightRule = (insightId: string, ruleId: string) => {
    if (!guard("生成ルールへの反映", ["settings", "approve"])) return
    setState((prev) =>
      produce(prev, (draft) => {
        const ins = draft.demo.insights.find((x) => x.id === insightId)
        const rule = ins?.improvements.find((r) => r.id === ruleId)
        if (!rule || rule.approved) return
        rule.approved = true
        draft.settings.rules.approvedInsightRules.push(rule.text)
      }),
    )
    toast.success(label("生成ルールに反映しました"), { description: "設定 > 問題生成ルール で確認・削除できます" })
  }

  // ---------------- 設定・その他 ----------------
  const updateSettings = (fn: (s: Draft<SystemSettings>) => void, message?: string) => {
    if (!can(stateRef.current.role, "settings")) {
      toast.error("権限がありません", { description: "設定変更は管理者のみ可能です" })
      return
    }
    setState((prev) => produce(prev, (draft) => fn(draft.settings)))
    if (message) toast.success(message)
  }

  // 表示の切り替えなので誰でもできる（実APIモードの操作は GAS が権限を確かめる）。デモではデモ用の名前・権限に戻す
  const setDataMode = (mode: DataMode) => {
    if (mode === "demo" && LIVE_AVAILABLE) return void toast.error("本番の管理画面ではデモモードを使いません")
    setState((prev) =>
      produce(prev, (draft) => {
        draft.settings.dataMode = mode
        if (mode === "demo") {
          draft.role = DEMO_IDENTITY.role
          draft.userName = DEMO_IDENTITY.userName
        } else {
          const me = draft.liveStatus.me
          draft.role = me?.role ?? "viewer"
          draft.userName = me ? me.name || me.email : ""
        }
      }),
    )
    toast.info(mode === "demo" ? "デモモードに切り替えました" : "実APIモードに切り替えました", { description: mode === "demo" ? "サンプルデータを表示しています" : "Google でログインすると、正本（Google Sheets）のデータを読み込みます" })
  }

  const toggleAutomation = () => {
    if (!can(stateRef.current.role, "automation")) {
      toast.error("権限がありません", { description: "自動処理の停止・再開は管理者のみ可能です" })
      return
    }
    const paused = !stateRef.current.settings.automationPaused
    setState((prev) => produce(prev, (draft) => void (draft.settings.automationPaused = paused)))
    update((d) => log(d, paused ? "自動処理を一時停止" : "自動処理を再開", "システム"))
    toast.success(paused ? "自動処理を一時停止しました" : "自動処理を再開しました")
  }

  const setEmergencyStop = (on: boolean) => {
    if (!can(stateRef.current.role, "automation")) {
      toast.error("権限がありません")
      return
    }
    setState((prev) => produce(prev, (draft) => {
      draft.settings.emergencyStop = on
      if (on) draft.settings.automationPaused = true
    }))
    update((d) => log(d, on ? "緊急停止を実行" : "緊急停止を解除", "システム"))
    toast[on ? "warning" : "success"](on ? "緊急停止しました。投稿・生成はすべて停止中です" : "緊急停止を解除しました（自動処理は一時停止のままです）")
  }

  const markNotificationRead = (id: string) => update((d) => {
    const n = d.notifications.find((x) => x.id === id)
    if (n) n.read = true
  })
  const markAllNotificationsRead = () => update((d) => d.notifications.forEach((n) => (n.read = true)))

  const testConnection = async (key: Integration["key"]) => {
    const res = await callBackend("接続テスト", (b) => b.testConnection(key))
    if (!res) return
    update((d) => {
      const i = d.integrations.find((x) => x.key === key)
      if (!i) return
      i.lastCheckedAt = nowIso()
      if (!isDemo()) {
        i.status = res
        i.note = res === "connected" ? "接続テストで疎通を確認" : "接続テストで疎通を確認できませんでした"
      }
    })
    if (isDemo()) toast.info("デモモードのため接続テストは擬似応答です", { description: "実際の接続は確認していません" })
    else if (res === "connected") toast.success("接続を確認しました")
    else toast.warning("接続を確認できませんでした", { description: `状態：${res}` })
  }

  const setRole = (role: Role) => {
    if (!isDemo()) return void toast.error("実APIモードの権限は GAS が決めます", { description: "設定 → ユーザーから権限を申請できます" })
    setState((prev) => produce(prev, (draft) => void (draft.role = role)))
    toast.info(`表示権限を切り替えました（デモ）`)
  }

  const changeUserRole = (userId: string, role: Role) => {
    if (!guard("権限変更", "users")) return
    update((d) => {
      const u = d.users.find((x) => x.id === userId)
      if (u) u.role = role
      log(d, `権限を変更（${role}）`, u?.name ?? userId, "/settings?tab=users")
    })
    toast.success(label("権限を変更しました"))
  }

  const addCategory = (name: string) => {
    if (!guard("分類の追加", "settings")) return
    update((d) => {
      d.categories.push({ id: `cat-${Date.now().toString(36)}`, name, active: true })
    })
    toast.success(label(`分類「${name}」を追加しました`))
  }
  const toggleCategory = (id: string) => {
    if (!guard("分類の変更", "settings")) return
    update((d) => {
      const c = d.categories.find((x) => x.id === id)
      if (c) c.active = !c.active
    })
  }

  const updateImageTemplate = (id: string, patch: Partial<ImageTemplate>) => {
    if (!guard("テンプレート変更", "settings")) return
    update((d) => {
      const t = d.imageTemplates.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
    })
  }
  const duplicateImageTemplate = (id: string) => {
    if (!guard("テンプレート複製", "settings")) return
    update((d) => {
      const t = d.imageTemplates.find((x) => x.id === id)
      if (t) d.imageTemplates.push({ ...t, id: `tpl-${Date.now().toString(36)}`, name: `${t.name}（コピー）`, active: false })
    })
    toast.success(label("テンプレートを複製しました"))
  }

  const resetDemo = () => {
    setState((prev) => ({ ...prev, demo: demoData(), settings: { ...clone(DEFAULT_SETTINGS), dataMode: prev.settings.dataMode } }))
    toast.success("デモデータを初期状態に戻しました")
  }

  const actions = {
    previewGeneration,
    startGeneration,
    cancelJob,
    upsertSlot,
    cancelSlot,
    moveSlot,
    copySlotTo,
    bulkSetSlots,
    applyTemplate,
    updateTemplateRow,
    assignQuestion,
    editQuestion,
    reverify,
    regenerateImage,
    approve,
    returnQuestion,
    rejectQuestion,
    regenerateQuestion,
    duplicateQuestion,
    setCertification,
    submitForReview,
    schedulePost,
    postNow,
    checkPostStatus,
    revealAnswer,
    fetchResults,
    syncSheets,
    switchToManual,
    markManualPosted,
    cancelPost,
    reschedulePost,
    recordInstagramPost,
    runInsight,
    loadLiveInsights,
    approveInsightRule,
    updateSettings,
    setDataMode,
    toggleAutomation,
    setEmergencyStop,
    markNotificationRead,
    markAllNotificationsRead,
    testConnection,
    setRole,
    changeUserRole,
    addCategory,
    toggleCategory,
    updateImageTemplate,
    duplicateImageTemplate,
    resetDemo,
    refreshLive,
    saveLiveQuestion,
    importLiveQuestions,
    loadLiveHistory,
    renderLiveCard,
    setLiveAutomation,
    liveGenerate,
    assignLiveDate,
    requestLiveRole,
    loadLiveUsers,
    setLiveUserRole,
    rejectLiveRoleRequest,
  }

  return { state, data, backendMode: backend.mode, actions, can: (p: Permission) => can(state.role, p) }
}

type StoreValue = ReturnType<typeof useQuizStoreValue>

const StoreContext = createContext<StoreValue | null>(null)

export function QuizStoreProvider({ children }: { children: React.ReactNode }) {
  const value = useQuizStoreValue()
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useQuiz() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useQuiz must be used within QuizStoreProvider")
  return ctx
}

/** 便利セレクタ */
/** 画面の「今日」。デモは固定の日付、実APIモードは日本時間の今日（GAS の自動投稿の状態があればその日付） */
export function useToday() {
  const { state } = useQuiz()
  return state.settings.dataMode === "demo" ? DEMO_TODAY : (state.liveStatus.automation?.today ?? jstToday())
}

export function useCategoryName() {
  const { data } = useQuiz()
  return useMemo(() => {
    const map = new Map(data.categories.map((c) => [c.id, c.name]))
    return (id: string) => (id === "auto" ? "自動" : id === "" ? "分類未設定" : map.get(id) ?? id)
  }, [data.categories])
}
