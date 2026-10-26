// ⚠ サンプルデータ（デモモード専用）。実データではありません。
// 実APIモードでは lib/services/live-adapter.ts 経由でDBから取得します。

import type {
  ActivityLog,
  AIInsight,
  AppNotification,
  AppUser,
  Category,
  ChoiceLabel,
  FactCheck,
  FactCheckStatus,
  GenerationJob,
  ImageTemplate,
  Integration,
  PlanSlot,
  Platform,
  PostJob,
  Question,
  QuestionStatus,
  ResponseSnapshot,
  SimilarQuestion,
  Source,
  SyncLog,
  SystemSettings,
  UsageRecord,
  WeeklyTemplateRow,
  DuplicateLevel,
  ImageStatus,
  CertificationStatus,
  PostStatus,
  ResponseCollectStatus,
} from "@/lib/types"
import { PIPELINE_STEPS } from "@/lib/constants"
import { addDays, addMonths, dateRange, DEMO_NOW, DEMO_TODAY, jstIso, shortHash, weekday } from "@/lib/format"

export const CATEGORIES: Category[] = [
  { id: "dev", name: "宇宙開発", active: true },
  { id: "explore", name: "宇宙探査", active: true },
  { id: "astro", name: "天文", active: true },
  { id: "biz", name: "宇宙ビジネス", active: true },
  { id: "basic", name: "宇宙基礎", active: true },
  { id: "policy", name: "宇宙政策", active: true },
  { id: "history", name: "歴史", active: true },
]

const CHECK_LABELS: [string, string][] = [
  ["fact", "問題文の事実確認"],
  ["choices", "選択肢の妥当性"],
  ["unique", "正解の一意性"],
  ["explanation", "解説の正確性"],
  ["source_exists", "出典URLの存在"],
  ["source_match", "出典本文との一致"],
  ["numbers", "数値・日付・単位"],
  ["freshness", "時事情報の鮮度"],
  ["ambiguity", "問題の曖昧さ"],
  ["duplicate", "過去問との重複"],
  ["image", "問題文と画像の一致"],
  ["length", "媒体ごとの文字数制限"],
]

function makeFactCheck(status: FactCheckStatus, overrides: Record<string, { result: "warn" | "fail" | "pending"; note: string }> = {}, concerns: string[] = [], checkedAt: string | null = DEMO_NOW): FactCheck {
  return {
    status,
    checkedAt: status === "pending" ? null : checkedAt,
    model: status === "pending" ? null : "gemini-2.5-pro",
    concerns,
    items: CHECK_LABELS.map(([key, label]) => {
      if (status === "pending") return { key, label, result: "pending" as const }
      const o = overrides[key]
      return o ? { key, label, result: o.result, note: o.note } : { key, label, result: "pass" as const }
    }),
  }
}

function src(id: string, title: string, publisher: string, url: string, tier: 1 | 2 | 3 | 4, excerpt: string): Source {
  return { id, title, publisher, url, tier, excerpt, checkedAt: "2026-10-18T10:12:00+09:00" }
}

function makeResponses(platform: Platform, postJobId: string, answer: ChoiceLabel, total: number | null, correctRate: number, finalized: boolean, impressions: number | null): ResponseSnapshot {
  if (total === null) {
    return { platform, postJobId, responses: null, correct: null, perChoice: { A: null, B: null, C: null }, impressions: null, clicks: null, finalized: false, collectedAt: null, ...(platform === "discord" ? { reactionEvents: null, uniqueVoters: null } : {}) }
  }
  const correct = Math.round(total * correctRate)
  const rest = total - correct
  const labels: ChoiceLabel[] = ["A", "B", "C"]
  const wrong = labels.filter((l) => l !== answer)
  const perChoice = { A: 0, B: 0, C: 0 } as Record<ChoiceLabel, number>
  perChoice[answer] = correct
  perChoice[wrong[0]] = Math.round(rest * 0.62)
  perChoice[wrong[1]] = rest - Math.round(rest * 0.62)
  return {
    platform,
    postJobId,
    responses: total,
    correct,
    perChoice,
    impressions,
    clicks: impressions ? Math.round(impressions * 0.031) : null,
    finalized,
    collectedAt: finalized ? jstIso(addDays(DEMO_TODAY, 0), "05:50") : DEMO_NOW,
    ...(platform === "discord" ? { reactionEvents: total + Math.round(total * 0.08), uniqueVoters: total } : {}),
  }
}

interface QSpec {
  id: string
  knowledgeId: string
  topic: string
  text: string
  choices: [string, string, string]
  answer: ChoiceLabel
  explanation: string
  categoryId: string
  difficulty: Question["difficulty"]
  platform: Platform
  timeliness?: Question["timeliness"]
  status: QuestionStatus
  plannedDate: string | null
  fc: FactCheck
  dup?: { level: DuplicateLevel; similar: SimilarQuestion[]; reusableFrom?: string | null }
  quality: [number, number, number, number, number]
  sources: Source[]
  imageStatus: ImageStatus
  cert?: CertificationStatus
  autoApprovable?: boolean
  blockers?: string[]
  createdAt: string
  reviewHistory?: Question["reviewHistory"]
  recheckBy?: string | null
}

function makeQuestion(s: QSpec): Question {
  const choices = s.choices.map((text, i) => ({ label: (["A", "B", "C"] as ChoiceLabel[])[i], text }))
  const snapshot = { text: s.text, choices, answer: s.answer, explanation: s.explanation }
  const confirmed = ["approved", "scheduled", "posted", "archived"].includes(s.status)
  return {
    id: s.id,
    knowledgeId: s.knowledgeId,
    topic: s.topic,
    text: s.text,
    choices,
    answer: s.answer,
    explanation: s.explanation,
    categoryId: s.categoryId,
    difficulty: s.difficulty,
    platform: s.platform,
    timeliness: s.timeliness ?? "evergreen",
    status: s.status,
    plannedDate: s.plannedDate,
    factCheck: s.fc,
    duplicate: { level: s.dup?.level ?? "none", similar: s.dup?.similar ?? [], reusableFrom: s.dup?.reusableFrom ?? null },
    quality: {
      interest: s.quality[0],
      answerability: s.quality[1],
      choiceValidity: s.quality[2],
      learning: s.quality[3],
      platformFit: s.quality[4],
    },
    sources: s.sources,
    versions: [
      {
        version: 1,
        hash: shortHash(JSON.stringify(snapshot)),
        createdAt: s.createdAt,
        author: "AI（gemini-2.5-flash）",
        summary: "AI生成・初版",
        snapshot,
      },
    ],
    confirmedVersion: confirmed ? 1 : null,
    history: [],
    responses: [],
    imageStatus: s.imageStatus,
    imageVersion: s.imageStatus === "ready" ? 1 : null,
    templateId: s.platform === "instagram" ? "tpl-ig" : s.platform === "x" ? "tpl-x" : "tpl-discord",
    autoApprovable: s.autoApprovable ?? false,
    autoApprovalBlockers: s.blockers ?? [],
    certification: s.cert ?? "none",
    reviewHistory: s.reviewHistory ?? [
      { at: s.createdAt, by: "AI生成ジョブ", action: "generated" },
      ...(confirmed ? [{ at: addDays(s.createdAt.slice(0, 10), 1) + "T11:00:00+09:00", by: "佐藤 美咲", action: "approved" as const }] : []),
    ],
    recheckBy: s.recheckBy ?? null,
    createdAt: s.createdAt,
    updatedAt: s.createdAt,
    generatedBy: "GJ-2026-1012",
    isSample: true,
  }
}

const passed = () => makeFactCheck("passed")

const RAW: QSpec[] = [
  // ---- 過去（9月出題・参照用） ----
  {
    id: "Q-2026-0091", knowledgeId: "K-HAYABUSA-ITOKAWA", topic: "はやぶさ", status: "archived", plannedDate: "2026-09-02", platform: "x",
    text: "小惑星イトカワから試料を持ち帰り、2010年に地球へ帰還した日本の探査機は？",
    choices: ["はやぶさ", "はやぶさ2", "あかつき"], answer: "A",
    explanation: "初代「はやぶさ」は2010年6月に帰還し、小惑星イトカワの微粒子を地球に届けました。小惑星からの試料回収は世界初です。",
    categoryId: "explore", difficulty: "beginner", fc: passed(), quality: [4, 5, 4, 4, 4],
    sources: [src("S-01", "小惑星探査機「はやぶさ」", "JAXA 宇宙科学研究所", "https://www.isas.jaxa.jp/missions/spacecraft/past/hayabusa.html", 1, "2010年6月13日に地球へ帰還し、カプセル内からイトカワの微粒子を確認")],
    imageStatus: "ready", createdAt: "2026-08-20T09:00:00+09:00", cert: "candidate",
  },
  {
    id: "Q-2026-0098", knowledgeId: "K-HAYABUSA2-RYUGU", topic: "はやぶさ2", status: "archived", plannedDate: "2026-09-10", platform: "discord",
    text: "探査機「はやぶさ2」が試料を採取し、地球に持ち帰った小惑星はどれ？",
    choices: ["リュウグウ", "イトカワ", "ベンヌ"], answer: "A",
    explanation: "はやぶさ2は小惑星リュウグウで2回のタッチダウンを行い、2020年12月に試料入りカプセルを地球へ届けました。",
    categoryId: "explore", difficulty: "beginner", fc: passed(), quality: [4, 5, 4, 4, 4],
    sources: [src("S-02", "小惑星探査機「はやぶさ2」", "JAXA", "https://www.hayabusa2.jaxa.jp/", 1, "2020年12月6日、リュウグウのサンプルを収めたカプセルを回収")],
    imageStatus: "ready", createdAt: "2026-08-28T09:00:00+09:00", cert: "candidate",
  },
  // ---- 出題済み X ----
  {
    id: "Q-2026-0142", knowledgeId: "K-JUPITER-LARGEST", topic: "木星", status: "posted", plannedDate: "2026-10-21", platform: "x",
    text: "太陽系で最も大きな惑星はどれ？", choices: ["木星", "土星", "海王星"], answer: "A",
    explanation: "木星の赤道半径は約7万1,500kmで、地球の約11倍。太陽系の惑星の中で最大です。",
    categoryId: "astro", difficulty: "beginner", fc: passed(), quality: [3, 5, 4, 3, 4],
    sources: [src("S-03", "Jupiter Facts", "NASA Science", "https://science.nasa.gov/jupiter/facts/", 1, "Jupiter is the largest planet in our solar system")],
    imageStatus: "ready", createdAt: "2026-10-10T09:00:00+09:00",
  },
  {
    id: "Q-2026-0143", knowledgeId: "K-ISS-ORBIT-PERIOD", topic: "国際宇宙ステーション", status: "posted", plannedDate: "2026-10-22", platform: "x",
    text: "国際宇宙ステーション（ISS）が地球を1周するのにかかる時間はおよそどれくらい？", choices: ["約90分", "約6時間", "約24時間"], answer: "A",
    explanation: "ISSは高度約400kmを秒速約7.7kmで周回し、約90分で地球を1周します。1日に約16周する計算です。",
    categoryId: "basic", difficulty: "beginner", fc: passed(), quality: [4, 4, 4, 4, 5],
    sources: [src("S-04", "国際宇宙ステーション（ISS）とは", "JAXA 有人宇宙技術部門", "https://humans-in-space.jaxa.jp/iss/about/", 1, "地球を約90分で1周")],
    imageStatus: "ready", createdAt: "2026-10-10T09:00:00+09:00",
  },
  {
    id: "Q-2026-0144", knowledgeId: "K-SPUTNIK1", topic: "人工衛星の歴史", status: "posted", plannedDate: "2026-10-23", platform: "x",
    text: "1957年に打ち上げられた、世界初の人工衛星の名前は？", choices: ["スプートニク1号", "エクスプローラー1号", "ボストーク1号"], answer: "A",
    explanation: "旧ソ連が1957年10月4日に打ち上げたスプートニク1号が世界初の人工衛星です。",
    categoryId: "history", difficulty: "beginner", fc: passed(), quality: [4, 4, 4, 4, 4],
    sources: [src("S-05", "Sputnik and the Origins of the Space Age", "NASA History", "https://www.nasa.gov/history/", 1, "On Oct. 4, 1957, the Soviet Union launched Sputnik 1")],
    imageStatus: "ready", createdAt: "2026-10-11T09:00:00+09:00", cert: "candidate",
  },
  {
    id: "Q-2026-0145", knowledgeId: "K-JWST-INFRARED", topic: "ジェイムズ・ウェッブ宇宙望遠鏡", status: "posted", plannedDate: "2026-10-24", platform: "x",
    text: "ジェイムズ・ウェッブ宇宙望遠鏡（JWST）が主に観測に用いる電磁波はどれ？", choices: ["X線", "赤外線", "紫外線"], answer: "B",
    explanation: "JWSTは赤外線観測に特化しており、遠方の銀河や塵に隠れた天体を観測できます。",
    categoryId: "astro", difficulty: "intermediate", fc: passed(), quality: [5, 3, 4, 5, 4],
    sources: [src("S-06", "Webb Space Telescope", "NASA", "https://science.nasa.gov/mission/webb/", 1, "Webb is primarily an infrared telescope")],
    imageStatus: "ready", createdAt: "2026-10-11T09:00:00+09:00",
  },
  {
    id: "Q-2026-0146", knowledgeId: "K-SLIM-LANDING-YEAR", topic: "SLIM", status: "posted", plannedDate: "2026-10-25", platform: "x",
    text: "JAXAの小型月着陸実証機「SLIM」が月面着陸に成功した年は？", choices: ["2023年", "2024年", "2025年"], answer: "B",
    explanation: "SLIMは2024年1月20日に月面へ着陸し、日本は月面着陸に成功した5番目の国となりました。",
    categoryId: "explore", difficulty: "intermediate", fc: passed(), quality: [4, 3, 4, 4, 4],
    sources: [src("S-07", "小型月着陸実証機 SLIM", "JAXA 宇宙科学研究所", "https://www.isas.jaxa.jp/missions/spacecraft/current/slim.html", 1, "2024年1月20日 月面着陸")],
    imageStatus: "ready", createdAt: "2026-10-12T09:00:00+09:00",
  },
  // ---- 出題済み Discord ----
  {
    id: "Q-2026-0147", knowledgeId: "K-MARS-MOONS", topic: "火星の衛星", status: "posted", plannedDate: "2026-10-21", platform: "discord",
    text: "火星の衛星はいくつある？", choices: ["1個", "2個", "4個"], answer: "B",
    explanation: "火星にはフォボスとダイモスの2つの衛星があります。",
    categoryId: "astro", difficulty: "beginner", fc: passed(), quality: [4, 5, 4, 3, 4],
    sources: [src("S-08", "Mars Moons", "NASA Science", "https://science.nasa.gov/mars/moons/", 1, "Mars has two small moons, Phobos and Deimos")],
    imageStatus: "ready", createdAt: "2026-10-10T09:00:00+09:00",
  },
  {
    id: "Q-2026-0148", knowledgeId: "K-APOLLO11", topic: "アポロ計画", status: "posted", plannedDate: "2026-10-22", platform: "discord",
    text: "人類初の月面着陸を成し遂げたミッションはどれ？", choices: ["アポロ8号", "アポロ11号", "アポロ13号"], answer: "B",
    explanation: "1969年7月20日、アポロ11号のアームストロング船長とオルドリン飛行士が月面に降り立ちました。",
    categoryId: "history", difficulty: "beginner", fc: passed(), quality: [3, 5, 4, 4, 4],
    sources: [src("S-09", "Apollo 11", "NASA", "https://www.nasa.gov/mission/apollo-11/", 1, "July 20, 1969 — first crewed lunar landing")],
    imageStatus: "ready", createdAt: "2026-10-10T09:00:00+09:00",
  },
  {
    id: "Q-2026-0149", knowledgeId: "K-QZSS-NAME", topic: "準天頂衛星システム", status: "posted", plannedDate: "2026-10-23", platform: "discord",
    text: "日本の衛星測位システム「準天頂衛星システム（QZSS）」の愛称は？", choices: ["ひまわり", "みちびき", "だいち"], answer: "B",
    explanation: "準天頂衛星システムの愛称は「みちびき」。GPSと組み合わせて高精度な測位を可能にします。",
    categoryId: "dev", difficulty: "beginner", fc: passed(), quality: [4, 4, 5, 4, 4],
    sources: [src("S-10", "みちびき（準天頂衛星システム）", "内閣府", "https://qzss.go.jp/", 1, "準天頂衛星システム「みちびき」")],
    imageStatus: "ready", createdAt: "2026-10-11T09:00:00+09:00",
  },
  {
    id: "Q-2026-0150", knowledgeId: "K-FALCON9-SPACEX", topic: "Falcon 9", status: "posted", plannedDate: "2026-10-24", platform: "discord",
    text: "第1段の再使用を実用化したロケット「Falcon 9」を開発した企業は？", choices: ["Blue Origin", "SpaceX", "Rocket Lab"], answer: "B",
    explanation: "Falcon 9はSpaceXが開発したロケットで、第1段ブースターの着陸・再使用を商業運用しています。",
    categoryId: "biz", difficulty: "beginner", fc: passed(), quality: [4, 5, 4, 3, 5],
    sources: [src("S-11", "Falcon 9", "SpaceX", "https://www.spacex.com/vehicles/falcon-9/", 2, "first orbital class rocket capable of reflight")],
    imageStatus: "ready", createdAt: "2026-10-12T09:00:00+09:00",
  },
  {
    id: "Q-2026-0151", knowledgeId: "K-FIRST-JAPANESE-SPACE", topic: "日本人宇宙飛行", status: "posted", plannedDate: "2026-10-25", platform: "discord",
    text: "日本人として初めて宇宙へ行った人物は？", choices: ["秋山豊寛", "毛利衛", "向井千秋"], answer: "A",
    explanation: "TBS記者の秋山豊寛さんが1990年12月、ソユーズ宇宙船でミール宇宙ステーションに滞在したのが日本人初の宇宙飛行です。",
    categoryId: "history", difficulty: "intermediate", fc: passed(), quality: [5, 3, 5, 4, 4],
    sources: [src("S-12", "日本人宇宙飛行士の歴史", "JAXA", "https://humans-in-space.jaxa.jp/", 1, "1990年 秋山豊寛氏がソユーズTM-11で宇宙へ")],
    imageStatus: "ready", createdAt: "2026-10-12T09:00:00+09:00", cert: "candidate",
  },
  // ---- 確定・予約済み ----
  {
    id: "Q-2026-0152", knowledgeId: "K-KARMAN-LINE", topic: "カーマン・ライン", status: "scheduled", plannedDate: "2026-10-26", platform: "x",
    text: "宇宙との境界として国際的に広く使われる「カーマン・ライン」の高度はおよそどれくらい？", choices: ["約10km", "約100km", "約1,000km"], answer: "B",
    explanation: "国際航空連盟（FAI）などは高度100kmを宇宙との境界「カーマン・ライン」としています。",
    categoryId: "basic", difficulty: "intermediate", fc: passed(), quality: [4, 4, 4, 5, 4],
    sources: [src("S-13", "100km Altitude Boundary for Astronautics", "FAI", "https://www.fai.org/page/icare-boundary", 2, "Kármán Line at 100km altitude")],
    imageStatus: "ready", createdAt: "2026-10-18T09:00:00+09:00",
  },
  {
    id: "Q-2026-0153", knowledgeId: "K-H3-TF2-YEAR", topic: "H3ロケット", status: "scheduled", plannedDate: "2026-10-26", platform: "discord",
    text: "日本の新型基幹ロケット「H3」の試験機2号機が打ち上げに成功した年は？", choices: ["2023年", "2024年", "2025年"], answer: "B",
    explanation: "H3ロケット試験機2号機は2024年2月17日に打ち上げられ、所定の軌道への投入に成功しました。",
    categoryId: "dev", difficulty: "intermediate", fc: passed(), quality: [4, 3, 4, 4, 4],
    sources: [src("S-14", "H3ロケット", "JAXA", "https://www.rocket.jaxa.jp/rocket/h3/", 1, "試験機2号機 2024年2月17日打ち上げ成功")],
    imageStatus: "ready", createdAt: "2026-10-18T09:00:00+09:00",
  },
  {
    id: "Q-2026-0154", knowledgeId: "K-ARTEMIS-LEAD", topic: "アルテミス計画", status: "approved", plannedDate: "2026-10-27", platform: "x",
    text: "有人月探査「アルテミス計画」を主導している宇宙機関はどれ？", choices: ["ESA（欧州宇宙機関）", "NASA（アメリカ航空宇宙局）", "JAXA（宇宙航空研究開発機構）"], answer: "B",
    explanation: "アルテミス計画はNASAが主導し、日本・欧州・カナダなどが参加する国際的な月探査計画です。",
    categoryId: "policy", difficulty: "beginner", fc: passed(), quality: [4, 5, 3, 4, 4],
    sources: [src("S-15", "Artemis", "NASA", "https://www.nasa.gov/humans-in-space/artemis/", 1, "NASA's Artemis campaign")],
    imageStatus: "ready", createdAt: "2026-10-19T09:00:00+09:00",
  },
  {
    id: "Q-2026-0155", knowledgeId: "K-SUNLIGHT-TIME", topic: "太陽光の到達時間", status: "approved", plannedDate: "2026-10-27", platform: "discord",
    text: "太陽の光が地球に届くまでにかかる時間はおよそどれくらい？", choices: ["約8秒", "約8分", "約8時間"], answer: "B",
    explanation: "太陽と地球の距離は約1億5,000万km。光の速さ（秒速約30万km）で約8分20秒かかります。",
    categoryId: "astro", difficulty: "beginner", fc: passed(), quality: [5, 5, 4, 4, 5],
    sources: [src("S-16", "How long does it take sunlight to reach Earth?", "NASA", "https://science.nasa.gov/sun/facts/", 1, "about 8 minutes 20 seconds")],
    imageStatus: "ready", createdAt: "2026-10-19T09:00:00+09:00",
  },
  // ---- 確認・承認待ち ----
  {
    id: "Q-2026-0156", knowledgeId: "K-SPACE-BASIC-ACT", topic: "宇宙基本法", status: "review", plannedDate: "2026-10-28", platform: "x",
    text: "日本の宇宙開発利用の基本理念を定めた「宇宙基本法」が制定された年は？", choices: ["2003年", "2008年", "2016年"], answer: "B",
    explanation: "宇宙基本法は2008年5月に成立し、同年8月に施行されました。宇宙の安全保障利用や産業振興の基本方針を定めています。",
    categoryId: "policy", difficulty: "advanced", quality: [3, 2, 4, 5, 3],
    fc: makeFactCheck("warning", { numbers: { result: "warn", note: "「制定」の定義（成立5月／施行8月）を解説で明示済み。問題文の表現確認を推奨" } }, ["成立日と施行日が異なるため、問題文を「成立した年」に変更する案があります"]),
    sources: [src("S-17", "宇宙基本法", "内閣府 宇宙開発戦略推進事務局", "https://www8.cao.go.jp/space/law/law.html", 1, "平成20年法律第43号")],
    imageStatus: "none", createdAt: "2026-10-24T05:10:00+09:00", autoApprovable: false,
    blockers: ["検証モード中（全件人間確認）", "数値・日付に要確認項目あり"],
  },
  {
    id: "Q-2026-0157", knowledgeId: "K-HAYABUSA2-RYUGU", topic: "はやぶさ2", status: "review", plannedDate: "2026-10-28", platform: "discord",
    text: "はやぶさ2がサンプルを採取した小惑星の名前は？", choices: ["リュウグウ", "イトカワ", "ベヌー"], answer: "A",
    explanation: "はやぶさ2は小惑星リュウグウに2度タッチダウンし、試料を採取しました。",
    categoryId: "explore", difficulty: "beginner", quality: [3, 5, 4, 3, 4],
    fc: makeFactCheck("warning", { duplicate: { result: "fail", note: "Q-2026-0098 と同一知識（K-HAYABUSA2-RYUGU）" } }, ["同一媒体（Discord）で2026年9月10日に同じ知識を出題済み。再出題可能日は11月10日です"]),
    dup: {
      level: "strong",
      reusableFrom: "2026-11-10",
      similar: [
        { questionId: "Q-2026-0098", knowledgeId: "K-HAYABUSA2-RYUGU", text: "探査機「はやぶさ2」が試料を採取し、地球に持ち帰った小惑星はどれ？", reason: "問題文の表現は異なるが、「はやぶさ2の試料採取対象＝リュウグウ」という同一の事実を問うている", similarity: 0.94, sameKnowledge: true, platform: "discord", postedAt: "2026-09-10", reusableFrom: "2026-11-10" },
        { questionId: "Q-2026-0091", knowledgeId: "K-HAYABUSA-ITOKAWA", text: "小惑星イトカワから試料を持ち帰り、2010年に地球へ帰還した日本の探査機は？", reason: "同じ題材（はやぶさシリーズ）だが、問う事実が異なるため別知識", similarity: 0.61, sameKnowledge: false, platform: "x", postedAt: "2026-09-02", reusableFrom: "2026-10-02" },
      ],
    },
    sources: [src("S-02", "小惑星探査機「はやぶさ2」", "JAXA", "https://www.hayabusa2.jaxa.jp/", 1, "リュウグウへのタッチダウン")],
    imageStatus: "none", createdAt: "2026-10-24T05:12:00+09:00", autoApprovable: false,
    blockers: ["強い重複疑義（同一媒体2暦月以内）", "検証モード中（全件人間確認）"],
  },
  {
    id: "Q-2026-0158", knowledgeId: "K-ISS-RETIRE-PLAN", topic: "ISS運用終了", status: "review", plannedDate: "2026-10-29", platform: "x", timeliness: "current",
    text: "米国が国際宇宙ステーション（ISS）の運用終了を計画している年は？", choices: ["2024年", "2030年", "2040年"], answer: "B",
    explanation: "NASAは2030年までISSを運用し、その後は商業宇宙ステーションへ移行する計画を公表しています。",
    categoryId: "policy", difficulty: "intermediate", quality: [5, 3, 4, 4, 4],
    fc: makeFactCheck("warning", { freshness: { result: "warn", note: "計画は変更される可能性あり。投稿直前に最新情報の再確認が必要" } }, ["時事性の高い計画情報のため、自動承認の対象外です", "「運用終了」と「軌道離脱」の時期の違いに注意"]),
    sources: [src("S-18", "International Space Station Transition", "NASA", "https://www.nasa.gov/international-space-station/", 1, "operate the station through 2030")],
    imageStatus: "none", createdAt: "2026-10-24T05:14:00+09:00", autoApprovable: false, recheckBy: "2026-10-28",
    blockers: ["高リスクの時事情報", "検証モード中（全件人間確認）"],
  },
  {
    id: "Q-2026-0159", knowledgeId: "K-CHANGE4-FARSIDE", topic: "月の裏側", status: "review", plannedDate: "2026-10-29", platform: "discord",
    text: "月の裏側への着陸に世界で初めて成功した探査機はどれ？", choices: ["嫦娥4号", "ルナ9号", "チャンドラヤーン3号"], answer: "A",
    explanation: "中国の嫦娥4号が2019年1月、世界で初めて月の裏側への軟着陸に成功しました。",
    categoryId: "explore", difficulty: "intermediate", fc: passed(), quality: [5, 4, 4, 4, 4],
    sources: [src("S-19", "Chang'e 4", "NASA Science", "https://science.nasa.gov/mission/change-4/", 1, "first spacecraft to land on the far side of the Moon (Jan 2019)")],
    imageStatus: "none", createdAt: "2026-10-24T05:16:00+09:00", autoApprovable: true,
    blockers: ["検証モード中（全件人間確認）"],
  },
  // ---- Instagramストック ----
  {
    id: "Q-2026-0130", knowledgeId: "K-SUN-SURFACE-TEMP", topic: "太陽", status: "approved", plannedDate: null, platform: "instagram",
    text: "太陽の表面（光球）の温度はおよそ何度？", choices: ["約6,000℃", "約60,000℃", "約600℃"], answer: "A",
    explanation: "太陽の表面（光球）の温度は約6,000℃（約5,800K）。中心部は約1,500万℃に達します。",
    categoryId: "astro", difficulty: "beginner", fc: passed(), quality: [4, 4, 4, 4, 5],
    sources: [src("S-20", "太陽の基本データ", "国立天文台", "https://www.nao.ac.jp/astro/sky/sun/", 1, "表面温度 約6,000度")],
    imageStatus: "ready", createdAt: "2026-10-01T09:00:00+09:00", recheckBy: "2027-01-01",
  },
  {
    id: "Q-2026-0131", knowledgeId: "K-PROXIMA-NEAREST", topic: "最も近い恒星", status: "approved", plannedDate: null, platform: "instagram",
    text: "太陽を除いて、地球から最も近い恒星はどれ？", choices: ["プロキシマ・ケンタウリ", "シリウス", "ベテルギウス"], answer: "A",
    explanation: "プロキシマ・ケンタウリは約4.2光年の距離にあり、太陽を除いて地球に最も近い恒星です。",
    categoryId: "astro", difficulty: "intermediate", fc: passed(), quality: [5, 4, 4, 4, 5],
    sources: [src("S-21", "Proxima Centauri", "NASA", "https://science.nasa.gov/", 1, "closest star to the Sun, about 4.2 light-years")],
    imageStatus: "ready", createdAt: "2026-10-02T09:00:00+09:00", recheckBy: "2027-01-02",
  },
  {
    id: "Q-2026-0132", knowledgeId: "K-JAXA-FOUNDED", topic: "JAXA", status: "approved", plannedDate: null, platform: "instagram",
    text: "宇宙航空研究開発機構（JAXA）が発足した年は？", choices: ["2003年", "1969年", "2010年"], answer: "A",
    explanation: "JAXAは2003年10月、ISAS・NAL・NASDAの3機関が統合して発足しました。",
    categoryId: "dev", difficulty: "intermediate", fc: passed(), quality: [3, 3, 4, 4, 4],
    sources: [src("S-22", "JAXAについて", "JAXA", "https://www.jaxa.jp/about/history/", 1, "2003年10月1日 発足")],
    imageStatus: "ready", createdAt: "2026-10-03T09:00:00+09:00", recheckBy: "2027-01-03",
  },
  // ---- 不採用 ----
  {
    id: "Q-2026-0139", knowledgeId: "K-HYDROGEN-ABUNDANT", topic: "宇宙の元素", status: "rejected", plannedDate: null, platform: "x",
    text: "宇宙で最も多く存在する元素は？", choices: ["水素", "ヘリウム", "酸素"], answer: "A",
    explanation: "宇宙に存在する原子の約9割は水素です。",
    categoryId: "basic", difficulty: "beginner", fc: passed(), quality: [2, 5, 2, 3, 3],
    sources: [src("S-23", "宇宙の元素組成", "国立天文台", "https://www.nao.ac.jp/", 1, "水素が最も多い")],
    imageStatus: "none", createdAt: "2026-10-15T09:00:00+09:00",
    reviewHistory: [
      { at: "2026-10-15T09:00:00+09:00", by: "AI生成ジョブ", action: "generated" },
      { at: "2026-10-15T14:20:00+09:00", by: "佐藤 美咲", action: "rejected", note: "選択肢の誤答が弱く、学習価値が低い" },
    ],
  },
]

// ---- 投稿ジョブ・回答データ ----
interface PostSeed {
  qid: string
  status: PostStatus
  responseStatus: ResponseCollectStatus
  total: number | null
  rate: number
  impressions: number | null
  error?: string
  revealed: boolean
}

const POST_SEEDS: PostSeed[] = [
  { qid: "Q-2026-0091", status: "posted", responseStatus: "finalized", total: 288, rate: 0.81, impressions: 9120, revealed: true },
  { qid: "Q-2026-0098", status: "posted", responseStatus: "finalized", total: 64, rate: 0.86, impressions: null, revealed: true },
  { qid: "Q-2026-0142", status: "posted", responseStatus: "finalized", total: 341, rate: 0.9, impressions: 10450, revealed: true },
  { qid: "Q-2026-0143", status: "posted", responseStatus: "finalized", total: 296, rate: 0.63, impressions: 9870, revealed: true },
  { qid: "Q-2026-0144", status: "posted", responseStatus: "finalized", total: 274, rate: 0.72, impressions: 8930, revealed: true },
  { qid: "Q-2026-0145", status: "unknown", responseStatus: "failed", total: null, rate: 0, impressions: null, error: "投稿APIがタイムアウト（504）。公開されたか確認できていません。自動再投稿は停止中です。", revealed: false },
  { qid: "Q-2026-0146", status: "posted", responseStatus: "collecting", total: 118, rate: 0.47, impressions: 3810, revealed: false },
  { qid: "Q-2026-0147", status: "posted", responseStatus: "finalized", total: 58, rate: 0.84, impressions: null, revealed: true },
  { qid: "Q-2026-0148", status: "posted", responseStatus: "finalized", total: 61, rate: 0.89, impressions: null, revealed: true },
  { qid: "Q-2026-0149", status: "failed", responseStatus: "not_started", total: null, rate: 0, impressions: null, error: "Discord Botの認証に失敗しました（401 Unauthorized）。トークンの有効期限を確認してください。", revealed: false },
  { qid: "Q-2026-0150", status: "posted", responseStatus: "finalized", total: 55, rate: 0.78, impressions: null, revealed: true },
  { qid: "Q-2026-0151", status: "posted", responseStatus: "collecting", total: 22, rate: 0.41, impressions: null, revealed: false },
  { qid: "Q-2026-0152", status: "scheduled", responseStatus: "not_started", total: null, rate: 0, impressions: null, revealed: false },
  { qid: "Q-2026-0153", status: "scheduled", responseStatus: "not_started", total: null, rate: 0, impressions: null, revealed: false },
]

function buildData() {
  const questions = RAW.map(makeQuestion)
  const byId = new Map(questions.map((q) => [q.id, q]))
  const postJobs: PostJob[] = []

  POST_SEEDS.forEach((seed, i) => {
    const q = byId.get(seed.qid)!
    const date = q.plannedDate!
    const id = `PJ-${date.replaceAll("-", "")}-${q.platform === "x" ? "X" : "DC"}`
    const isPublished = seed.status === "posted"
    const externalId = isPublished ? `${q.platform === "x" ? "18" : "12"}${(4471230 + i * 137).toString()}` : null
    const job: PostJob = {
      id,
      questionId: q.id,
      questionVersion: 1,
      platform: q.platform,
      date,
      scheduledAt: jstIso(date, "06:00"),
      publishedAt: isPublished ? jstIso(date, "06:00") : null,
      status: seed.status,
      url: isPublished ? (q.platform === "x" ? `https://x.com/cosmobase_jp/status/${externalId}` : `https://discord.com/channels/000/111/${externalId}`) : null,
      externalId,
      responseStatus: seed.responseStatus,
      answerRevealed: seed.revealed,
      error: seed.error ?? null,
      syncStatus: seed.responseStatus === "finalized" ? (seed.qid === "Q-2026-0144" ? "failed" : "synced") : "unsynced",
    }
    postJobs.push(job)
    q.history.push({ postJobId: id, platform: q.platform, publishedAt: job.publishedAt, externalId, url: job.url, status: job.status, version: 1 })
    if (isPublished || seed.status === "unknown") {
      q.responses.push(makeResponses(q.platform, id, q.answer, seed.total, seed.rate, seed.responseStatus === "finalized", seed.impressions))
    }
  })

  // ---- 出題計画 ----
  const slots: PlanSlot[] = []
  const qByDatePlatform = new Map(questions.filter((q) => q.plannedDate).map((q) => [`${q.plannedDate}_${q.platform}`, q]))
  const rotation = ["history", "dev", "explore", "astro", "biz", "basic", "policy"]
  for (const date of dateRange("2026-10-19", "2026-11-14")) {
    for (const platform of ["x", "discord"] as Platform[]) {
      const q = qByDatePlatform.get(`${date}_${platform}`)
      const job = postJobs.find((p) => p.date === date && p.platform === platform)
      let status: PlanSlot["status"] = "waiting"
      if (q) {
        if (job?.status === "posted") status = job.responseStatus === "finalized" ? "aggregated" : "posted"
        else if (job?.status === "failed" || job?.status === "unknown") status = "failed"
        else if (q.status === "scheduled") status = "scheduled"
        else if (q.status === "approved") status = "confirmed"
        else if (q.status === "review") status = "review"
      } else if (date < "2026-10-21") {
        status = "aggregated"
      }
      const special = date === "2026-11-03" && platform === "x"
      slots.push({
        id: `SL-${date}-${platform}`,
        date,
        platform,
        categoryId: special ? "history" : q?.categoryId ?? rotation[weekday(date)],
        difficulty: special ? "intermediate" : "auto",
        theme: special ? "文化の日：日本の宇宙開発史" : q?.topic ?? "",
        format: "auto",
        timeliness: special ? "evergreen" : "auto",
        time: "06:00",
        instructions: special ? "糸川英夫・ペンシルロケットなど日本の宇宙開発の原点に関する問題" : "",
        generation: "auto",
        priority: special ? "high" : "normal",
        status,
        questionId: q?.id ?? null,
        source: special ? "manual" : "template",
      })
    }
  }

  return { questions, postJobs, slots }
}

const built = buildData()
export const MOCK_QUESTIONS = built.questions
export const MOCK_POST_JOBS = built.postJobs
export const MOCK_SLOTS = built.slots

export const MOCK_WEEKLY_TEMPLATE: WeeklyTemplateRow[] = [0, 1, 2, 3, 4, 5, 6].flatMap((wd) => {
  const rotation = ["history", "dev", "explore", "astro", "biz", "basic", "policy"]
  return (["x", "discord", "instagram"] as Platform[]).map((platform) => ({
    weekday: wd,
    platform,
    enabled: platform !== "instagram",
    categoryId: rotation[wd],
    difficulty: (wd === 6 ? "advanced" : wd === 0 ? "beginner" : "auto") as WeeklyTemplateRow["difficulty"],
    timeliness: (wd === 4 ? "current" : "auto") as WeeklyTemplateRow["timeliness"],
    generation: "auto" as const,
    time: "06:00",
  }))
})

export const MOCK_JOBS: GenerationJob[] = [
  {
    id: "GJ-2026-1024",
    mode: "daily",
    status: "completed",
    startedAt: "2026-10-24T05:00:00+09:00",
    finishedAt: "2026-10-24T05:18:00+09:00",
    platforms: ["x", "discord"],
    range: { from: "2026-10-28", to: "2026-10-29" },
    total: 4,
    completed: 4,
    success: 1,
    needsReview: 3,
    rejected: 0,
    errors: 0,
    steps: PIPELINE_STEPS.map((s) => ({ ...s, status: "done", startedAt: "2026-10-24T05:00:00+09:00", finishedAt: "2026-10-24T05:18:00+09:00" })),
    model: "gemini-2.5-flash",
    estimatedCostJpy: 7.2,
    actualCostJpy: 6.4,
    resultIds: ["Q-2026-0156", "Q-2026-0157", "Q-2026-0158", "Q-2026-0159"],
    targetSlotIds: [],
    options: { count: 4, categoryId: "auto", difficulty: "auto", theme: "", usePlan: true, usePastAnalysis: true, excludeGenerated: true, autoApprove: false, model: "gemini-2.5-flash", instructions: "" },
    isDemo: true,
  },
]

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  { id: "N-1", level: "error", kind: "post_failed", title: "Discord投稿に失敗しました", description: "10月23日のクイズ（Q-2026-0149）。Bot認証エラー（401）", href: "/posts?tab=issues", createdAt: "2026-10-23T06:00:30+09:00", read: false },
  { id: "N-2", level: "warning", kind: "post_failed", title: "X投稿の公開状況が不明です", description: "10月24日（Q-2026-0145）。確認が完了するまで自動再投稿しません", href: "/posts?tab=issues", createdAt: "2026-10-24T06:01:10+09:00", read: false },
  { id: "N-3", level: "warning", kind: "review_waiting", title: "確認・承認待ちが4件あります", description: "10月28日・29日の出題分。うち1件に強い重複疑義", href: "/reviews", createdAt: "2026-10-24T05:18:00+09:00", read: false },
  { id: "N-4", level: "error", kind: "sync_failed", title: "Sheets同期に失敗しました", description: "10月23日 X（Q-2026-0144）の集計データ。再実行できます", href: "/kpi", createdAt: "2026-10-24T05:52:00+09:00", read: true },
]

export const MOCK_ACTIVITY: ActivityLog[] = [
  { id: "A-1", at: "2026-10-25T06:00:02+09:00", actor: "自動投稿", action: "クイズを投稿（デモ記録）", target: "X / Q-2026-0146", href: "/questions/Q-2026-0146" },
  { id: "A-2", at: "2026-10-25T06:00:01+09:00", actor: "自動投稿", action: "クイズを投稿（デモ記録）", target: "Discord / Q-2026-0151", href: "/questions/Q-2026-0151" },
  { id: "A-3", at: "2026-10-25T05:55:00+09:00", actor: "自動投稿", action: "正解・解説を公開（デモ記録）", target: "Discord / Q-2026-0150", href: "/questions/Q-2026-0150" },
  { id: "A-4", at: "2026-10-24T18:20:00+09:00", actor: "佐藤 美咲", action: "問題を承認", target: "Q-2026-0155", href: "/questions/Q-2026-0155" },
  { id: "A-5", at: "2026-10-24T05:18:00+09:00", actor: "AI生成ジョブ", action: "毎日自動生成が完了（4件）", target: "GJ-2026-1024", href: "/generate" },
]

export const MOCK_INTEGRATIONS: Integration[] = [
  { key: "supabase", name: "Supabase（DB・認証）", status: "demo", note: "未接続。デモデータをブラウザ内メモリで使用中", lastCheckedAt: null },
  { key: "gemini", name: "Gemini API", status: "demo", note: "未接続。生成・検証は擬似処理です", lastCheckedAt: null },
  { key: "x", name: "X API（アンケート投稿）", status: "unverified", note: "画像なし・本文＋投票（1/2/3）。OAuth 1.0a での投稿・結果取得を技術検証中", lastCheckedAt: null },
  { key: "discord", name: "Discord Bot", status: "demo", note: "未接続。投稿・リアクション集計は擬似処理です", lastCheckedAt: null },
  { key: "instagram", name: "Instagram", status: "disconnected", note: "投稿休止中（ストック管理のみ）", lastCheckedAt: null },
  { key: "sheets", name: "Google Sheets API", status: "demo", note: "未接続。同期は擬似処理です", lastCheckedAt: null },
  { key: "storage", name: "画像ストレージ", status: "demo", note: "未接続。画像はブラウザ内で描画", lastCheckedAt: null },
]

export const MOCK_INSIGHTS: AIInsight[] = [
  {
    id: "AI-2026-007",
    scope: "platform",
    targetLabel: "X・直近30日（サンプル）",
    createdAt: "2026-10-20T15:00:00+09:00",
    model: "gemini-2.5-pro",
    status: "completed",
    isDemo: true,
    facts: [
      "回答数が多い上位5問のうち4問が初級・名称問題だった",
      "数値を問う問題（年号・距離）は正答率が平均より約18ポイント低い",
      "正解位置がAの問題が直近10問中6問で偏りがある",
    ],
    hypotheses: [
      "タイムラインで直感的に答えられる名称問題は、回答のハードルが低い可能性",
      "年号問題は誤答選択肢が近接していると難しく感じられ、回答を見送られている可能性",
    ],
    improvements: [
      { id: "R-1", text: "X向けは名称問題を週3回以上とし、年号問題は選択肢の年差を5年以上空ける", approved: false },
      { id: "R-2", text: "正解位置がA/B/Cで均等になるよう、生成時に偏り抑制を強める", approved: true },
    ],
    verification: ["2週間、名称問題比率を上げた期間と比較し、平均回答数をA/B比較する"],
    cautions: ["サンプル期間が短く、曜日・時事ニュースの影響を分離できていない", "表示数の取得可否がAPI仕様に依存するため、回答率は参考値"],
  },
]

export const MOCK_SYNC_LOGS: SyncLog[] = [
  { id: "SY-1", at: "2026-10-25T05:52:00+09:00", target: "QuizManager_回答集計", rows: 2, status: "synced", message: "10月24日分（デモ記録）" },
  { id: "SY-2", at: "2026-10-24T05:52:00+09:00", target: "QuizManager_回答集計", rows: 1, status: "failed", message: "Q-2026-0144: 書き込み権限エラー（デモ記録）" },
  { id: "SY-3", at: "2026-10-23T05:52:00+09:00", target: "QuizManager_回答集計", rows: 2, status: "synced", message: "10月22日分（デモ記録）" },
]

export const MOCK_TEMPLATES: ImageTemplate[] = [
  { id: "tpl-x", name: "X標準（16:9）", platform: "x", aspect: "16:9", background: "orbit", accent: "cyan", active: true },
  { id: "tpl-discord", name: "Discord標準（16:9）", platform: "discord", aspect: "16:9", background: "grid", accent: "green", active: true },
  { id: "tpl-ig", name: "Instagramカルーセル（4:5）", platform: "instagram", aspect: "4:5", background: "orbit", accent: "cyan", active: true },
  { id: "tpl-square", name: "汎用スクエア（1:1）", platform: "x", aspect: "1:1", background: "plain", accent: "cyan", active: false },
]

export const MOCK_USERS: AppUser[] = [
  { id: "U-1", name: "山田 太一", email: "yamada@example.jp", role: "admin", lastActiveAt: DEMO_NOW },
  { id: "U-2", name: "佐藤 美咲", email: "sato@example.jp", role: "approver", lastActiveAt: "2026-10-24T18:20:00+09:00" },
  { id: "U-3", name: "鈴木 健", email: "suzuki@example.jp", role: "editor", lastActiveAt: "2026-10-23T21:05:00+09:00" },
  { id: "U-4", name: "高橋 彩", email: "takahashi@example.jp", role: "viewer", lastActiveAt: "2026-10-20T12:40:00+09:00" },
]

export const MOCK_USAGE: UsageRecord[] = [
  { month: "2026-06", aiJpy: 420, snsJpy: 0, dbJpy: 0 },
  { month: "2026-07", aiJpy: 610, snsJpy: 0, dbJpy: 0 },
  { month: "2026-08", aiJpy: 780, snsJpy: 150, dbJpy: 0 },
  { month: "2026-09", aiJpy: 920, snsJpy: 150, dbJpy: 0 },
  { month: "2026-10", aiJpy: 860, snsJpy: 150, dbJpy: 0 },
]

export const DEFAULT_SETTINGS: SystemSettings = {
  dataMode: "demo",
  automationPaused: false,
  emergencyStop: false,
  verificationMode: true,
  brand: { name: "Cosmo Base", logoText: "CB", logoDataUrl: null },
  kpiDashboardUrl: "https://lookerstudio.google.com/",
  ai: {
    defaultModel: "gemini-2.5-flash",
    stepModels: { generate: "gemini-2.5-flash", verify: "gemini-2.5-pro", analyze: "gemini-2.5-pro" },
    searchEnabled: true,
    maxRegenerations: 3,
    dailyGenerationTime: "05:00",
    dailyGenerationEnabled: true,
    dailyLookaheadDays: 7,
    monthlyBudgetJpy: 3000,
    budgetWarnRatio: 0.8,
    stopOnBudget: true,
  },
  posting: {
    defaultTime: "06:00",
    precheckTime: "05:45",
    closeTime: "05:50",
    answerTime: "05:55",
    instagramActive: false,
    instagramMinStock: 3,
    failureNotifyTo: "ops@example.jp",
  },
  rules: {
    sameplatformMonths: 2,
    crossPlatformMonths: 1,
    balanceAnswerPosition: true,
    platformPolicies: {
      x: "タイムラインで3秒以内に読める短文。名称・数値を中心に、選択肢は25字以内。",
      discord: "コミュニティ向けにやや深い知識も可。解説で背景を補足する。",
      instagram: "画像で完結する構成。カルーセル8ページ（表紙・問題・選択肢・正解・解説）。",
    },
    difficultyDefinitions: {
      beginner: "宇宙に興味を持ち始めた人が知っている、または直感で答えられる",
      intermediate: "ニュースや解説記事を日常的に読む人が答えられる",
      advanced: "専門的な知識や正確な数値・年号の記憶が必要",
    },
    qualityItems: [
      { key: "interest", label: "興味・発見", enabled: true },
      { key: "answerability", label: "回答しやすさ", enabled: true },
      { key: "choiceValidity", label: "選択肢の妥当性", enabled: true },
      { key: "learning", label: "学習価値", enabled: true },
      { key: "platformFit", label: "媒体への適合性", enabled: true },
    ],
    recheckDaysForCurrent: 7,
    approvedInsightRules: ["正解位置がA/B/Cで均等になるよう、生成時に偏り抑制を強める"],
  },
  sheets: { spreadsheetName: "Cosmo Base 宇宙クイズ KPI", targetTab: "QuizManager_回答集計", autoSync: true },
  notifications: {
    post_failed: { inApp: true, email: true },
    aggregate_failed: { inApp: true, email: true },
    verify_error: { inApp: true, email: false },
    review_waiting: { inApp: true, email: false },
    ig_stock: { inApp: true, email: false },
    budget: { inApp: true, email: true },
    sync_failed: { inApp: true, email: false },
    generation: { inApp: true, email: false },
  },
}

/** デモ生成で使用する問題候補プール（サンプル） */
export const GENERATION_POOL: Omit<QSpec, "id" | "status" | "plannedDate" | "platform" | "createdAt" | "imageStatus" | "fc">[] = [
  { knowledgeId: "K-PENCIL-ROCKET", topic: "ペンシルロケット", text: "1955年に糸川英夫らが水平発射実験を行った、日本のロケット開発の原点とされる小型ロケットは？", choices: ["ペンシルロケット", "カッパロケット", "ラムダロケット"], answer: "A", explanation: "全長23cmのペンシルロケットは1955年に東京・国分寺で水平発射試験が行われ、日本のロケット開発の出発点となりました。", categoryId: "history", difficulty: "intermediate", quality: [5, 4, 4, 5, 4], sources: [src("S-30", "ペンシルロケット", "JAXA 宇宙科学研究所", "https://www.isas.jaxa.jp/", 1, "1955年 国分寺で水平発射実験")] },
  { knowledgeId: "K-SATURN-RINGS", topic: "土星の環", text: "土星の環は主に何でできている？", choices: ["氷の粒", "鉄の粒", "ガス"], answer: "A", explanation: "土星の環は主に氷の粒子でできており、大きさは数cmから数mまでさまざまです。", categoryId: "astro", difficulty: "beginner", quality: [5, 4, 4, 4, 5], sources: [src("S-31", "Saturn Rings", "NASA Science", "https://science.nasa.gov/saturn/", 1, "rings are made of chunks of ice and rock")] },
  { knowledgeId: "K-GEO-ALTITUDE", topic: "静止軌道", text: "静止衛星が周回する静止軌道の高度はおよそどれくらい？", choices: ["約400km", "約36,000km", "約38万km"], answer: "B", explanation: "静止軌道は赤道上空約35,786km。地球の自転と同じ周期で周回するため、地上からは静止して見えます。", categoryId: "basic", difficulty: "intermediate", quality: [4, 3, 4, 5, 4], sources: [src("S-32", "人工衛星の軌道", "JAXA", "https://www.jaxa.jp/", 1, "静止軌道 高度約36,000km")] },
  { knowledgeId: "K-VOYAGER1-INTERSTELLAR", topic: "ボイジャー1号", text: "人類が打ち上げた探査機として初めて太陽圏を脱出し、星間空間に到達したのは？", choices: ["ボイジャー1号", "パイオニア10号", "ニュー・ホライズンズ"], answer: "A", explanation: "ボイジャー1号は2012年8月に太陽圏界面を越え、星間空間に到達した最初の探査機となりました。", categoryId: "explore", difficulty: "intermediate", quality: [5, 4, 4, 4, 4], sources: [src("S-33", "Voyager 1", "NASA JPL", "https://science.nasa.gov/mission/voyager/", 1, "entered interstellar space in August 2012")] },
  { knowledgeId: "K-STARLINK", topic: "衛星通信", text: "SpaceXが展開している、多数の低軌道衛星によるインターネットサービスの名称は？", choices: ["Starlink", "Kuiper", "OneWeb"], answer: "A", explanation: "StarlinkはSpaceXが運用する低軌道衛星コンステレーションによる通信サービスです。", categoryId: "biz", difficulty: "beginner", quality: [4, 5, 3, 3, 5], sources: [src("S-34", "Starlink", "SpaceX", "https://www.starlink.com/", 2, "Starlink satellite internet")] },
  { knowledgeId: "K-SPACE-ACTIVITY-ACT", topic: "宇宙活動法", text: "日本で人工衛星の打上げや管理の許可制度を定めた、通称「宇宙活動法」が全面施行された年は？", choices: ["2008年", "2018年", "2023年"], answer: "B", explanation: "宇宙活動法（人工衛星等の打上げ及び人工衛星の管理に関する法律）は2016年成立、2018年11月に全面施行されました。", categoryId: "policy", difficulty: "advanced", quality: [3, 2, 4, 5, 3], sources: [src("S-35", "宇宙活動法", "内閣府", "https://www8.cao.go.jp/space/", 1, "平成30年11月15日 全面施行")] },
  { knowledgeId: "K-KIBO", topic: "きぼう", text: "国際宇宙ステーションに設置されている日本の実験棟の愛称は？", choices: ["きぼう", "こうのとり", "かぐや"], answer: "A", explanation: "日本実験棟「きぼう」はISS最大の実験モジュールで、2009年に完成しました。", categoryId: "dev", difficulty: "beginner", quality: [4, 5, 4, 4, 4], sources: [src("S-36", "きぼう日本実験棟", "JAXA", "https://humans-in-space.jaxa.jp/kibo/", 1, "日本実験棟「きぼう」")] },
  { knowledgeId: "K-HAYABUSA2-RYUGU", topic: "はやぶさ2", text: "はやぶさ2が2回のタッチダウンを行った小惑星は？", choices: ["リュウグウ", "イトカワ", "ディディモス"], answer: "A", explanation: "はやぶさ2は2019年にリュウグウへ2回タッチダウンしました。", categoryId: "explore", difficulty: "beginner", quality: [3, 5, 4, 3, 4], sources: [src("S-02b", "はやぶさ2", "JAXA", "https://www.hayabusa2.jaxa.jp/", 1, "2回のタッチダウン")] },
  { knowledgeId: "K-VENUS-HOTTEST", topic: "金星", text: "太陽系の惑星で、表面温度が最も高いのはどれ？", choices: ["水星", "金星", "火星"], answer: "B", explanation: "金星は厚い二酸化炭素の大気による温室効果で、表面温度が約460℃と水星より高くなります。", categoryId: "astro", difficulty: "intermediate", quality: [5, 4, 5, 5, 4], sources: [src("S-37", "Venus Facts", "NASA Science", "https://science.nasa.gov/venus/", 1, "Venus is the hottest planet")] },
  { knowledgeId: "K-AKATSUKI", topic: "あかつき", text: "金星の大気を観測するため2015年に金星周回軌道へ投入された日本の探査機は？", choices: ["あかつき", "みお", "ひとみ"], answer: "A", explanation: "金星探査機「あかつき」は2010年に打ち上げられ、2015年12月に金星周回軌道への投入に成功しました。", categoryId: "explore", difficulty: "advanced", quality: [4, 2, 4, 4, 3], sources: [src("S-38", "金星探査機あかつき", "JAXA 宇宙科学研究所", "https://www.isas.jaxa.jp/", 1, "2015年12月 金星周回軌道投入")] },
]

export function makeGeneratedQuestion(
  seq: number,
  poolIndex: number,
  platform: Platform,
  date: string | null,
  createdAt: string,
  outcome: "pass" | "review" | "duplicate" | "reject",
  jobId: string,
): Question {
  const base = GENERATION_POOL[poolIndex % GENERATION_POOL.length]
  const isDup = outcome === "duplicate" || base.knowledgeId === "K-HAYABUSA2-RYUGU"
  const fc =
    outcome === "reject"
      ? makeFactCheck("failed", { unique: { result: "fail", note: "正解が一意に定まらない可能性（出典間で記述が異なる）" } }, ["出典間で数値が一致しません"], createdAt)
      : outcome === "review" || isDup
        ? makeFactCheck("warning", isDup ? { duplicate: { result: "fail", note: "既出問題と同一知識の可能性" } } : { source_match: { result: "warn", note: "出典本文の該当箇所が要約表現のため人間確認を推奨" } }, isDup ? ["既出問題と同じ知識を問う可能性があります"] : ["出典本文との一致度が基準をわずかに下回りました"], createdAt)
        : makeFactCheck("passed", {}, [], createdAt)
  const q = makeQuestion({
    ...base,
    id: `Q-2026-${String(seq).padStart(4, "0")}`,
    platform,
    plannedDate: date,
    createdAt,
    status: outcome === "reject" ? "rejected" : "review",
    imageStatus: outcome === "pass" ? "ready" : "none",
    fc,
    dup: isDup
      ? {
          level: "strong",
          reusableFrom: addMonths(DEMO_TODAY, 1),
          similar: [{ questionId: "Q-2026-0098", knowledgeId: "K-HAYABUSA2-RYUGU", text: "探査機「はやぶさ2」が試料を採取し、地球に持ち帰った小惑星はどれ？", reason: "同一の事実（はやぶさ2の探査対象＝リュウグウ）を問うている", similarity: 0.91, sameKnowledge: true, platform: "discord", postedAt: "2026-09-10", reusableFrom: platform === "discord" ? "2026-11-10" : "2026-10-10" }],
        }
      : undefined,
    autoApprovable: outcome === "pass",
    blockers: outcome === "pass" ? [] : outcome === "reject" ? ["正解の一意性NG"] : isDup ? ["強い重複疑義"] : ["出典本文との一致に要確認"],
    reviewHistory: [{ at: createdAt, by: `AI生成ジョブ ${jobId}`, action: "generated" }],
  })
  q.generatedBy = jobId
  if (isDup && platform !== "discord") {
    // 異なる媒体で1暦月以上経過しているため再出題制限には抵触しない
    q.duplicate.level = "weak"
    q.duplicate.reusableFrom = "2026-10-10"
    q.autoApprovalBlockers = ["同一知識の出題履歴あり（再出題可能・要確認）"]
  }
  return q
}
