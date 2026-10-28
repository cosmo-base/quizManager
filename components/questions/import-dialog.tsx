"use client"

// 実APIモード：Excel（.xlsx）・CSV から問題をまとめて下書きで登録する。
// ① ファイルを選ぶ → ② 見出しの行と列の割り当てを確かめる（ファイルごとに列の並びが違ってもよい）
// → ③ 1 行ずつ確認・修正して登録 → ④ 結果。ファイルはブラウザの中で読み、正本には問題の内容だけを送る。
import { useMemo, useState } from "react"
import { ArrowLeft, Download, FileSpreadsheet, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SimpleSelect } from "@/components/shared/simple-select"
import { StatusBadge } from "@/components/shared/status-badge"
import { useQuiz } from "@/lib/store/quiz-store"
import { columnLetter, readTableFile, type TableSheet } from "@/lib/import/table-file"
import {
  buildRows,
  buildTemplateXlsx,
  FIELDS,
  guessColumns,
  guessHeaderRow,
  rowError,
  rowWarning,
  sequentialColumns,
  targetPlatforms,
  toImportInputs,
  type ColumnMap,
  type FieldKey,
  type ImportPlatform,
  type ImportRow,
} from "@/lib/import/question-import"
import { CHOICE_LABELS, normalizeQuestionText, TOPIC_MAX } from "@/lib/question-validate"
import type { ImportQuestionsResult } from "@/lib/services/gas-contract"
import type { Category, ChoiceLabel, Difficulty } from "@/lib/types"
import { DIFFICULTY_LABEL } from "@/lib/constants"
import { cn } from "@/lib/utils"

type Step = "file" | "map" | "review" | "done"

const PLATFORM_OPTIONS: { value: ImportPlatform; label: string }[] = [
  { value: "x", label: "X" },
  { value: "discord", label: "Discord" },
  { value: "both", label: "両方（X 用と Discord 用の 2 問）" },
]
const PLATFORM_SHORT: Record<ImportPlatform, string> = { x: "X", discord: "Discord", both: "両方" }

function downloadTemplate(categories: Category[]) {
  const blob = new Blob([buildTemplateXlsx(categories) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "問題取り込みテンプレート.xlsx"
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ImportQuestionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, actions } = useQuiz()
  const [step, setStep] = useState<Step>("file")
  const [fileName, setFileName] = useState("")
  const [sheets, setSheets] = useState<TableSheet[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(1)
  const [columns, setColumns] = useState<ColumnMap>(sequentialColumns())
  const [fallback, setFallback] = useState<ImportPlatform>("x")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportQuestionsResult | null>(null)

  const table = sheets[sheetIdx]?.rows ?? []
  const activeCategories = useMemo(() => data.categories.filter((c) => c.active), [data.categories])

  const reset = () => {
    setStep("file")
    setSheets([])
    setRows([])
    setResult(null)
    setError(null)
    setEditing(null)
  }

  const applyHeader = (sheetRows: string[][], row: number) => {
    setHeaderRow(row)
    setColumns(row > 0 ? guessColumns(sheetRows[row - 1] ?? []) : sequentialColumns())
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const read = (await readTableFile(file)).filter((s) => s.rows.some((r) => r.some((c) => c.trim())))
      if (!read.length) throw new Error("ファイルに読み込める行がありません")
      // シートが複数あるときは、見出しが一番それらしいシートを最初に選ぶ
      const score = (s: TableSheet) => Object.values(guessColumns(s.rows[guessHeaderRow(s.rows) - 1] ?? [])).filter((v) => v !== null).length
      const best = read.reduce((bi, s, i) => (score(s) > score(read[bi]) ? i : bi), 0)
      setFileName(file.name)
      setSheets(read)
      setSheetIdx(best)
      applyHeader(read[best].rows, guessHeaderRow(read[best].rows))
      setStep("map")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // 正本にある問題（却下・アーカイブは除く）の「媒体:問題文」
  const existing = useMemo(
    () => new Set(data.questions.filter((q) => q.status !== "rejected" && q.status !== "archived").map((q) => `${q.platform}:${normalizeQuestionText(q.text)}`)),
    [data.questions],
  )
  const errors = useMemo(() => new Map(rows.map((r) => [r.rowNo, rowError(r, existing, rows)])), [rows, existing])
  const warnings = useMemo(() => new Map(rows.map((r) => [r.rowNo, rowWarning(r, data.questions)])), [rows, data.questions])
  const ready = rows.filter((r) => r.include && !errors.get(r.rowNo))
  const readyCount = ready.reduce((n, r) => n + (r.platform ? targetPlatforms(r.platform).length : 0), 0)
  const errorCount = rows.filter((r) => r.include && errors.get(r.rowNo)).length

  const missing = FIELDS.filter((f) => f.required && columns[f.key] === null)
  const width = Math.max(0, ...table.slice(0, 50).map((r) => r.length))
  const header = headerRow > 0 ? table[headerRow - 1] ?? [] : []
  const columnOptions = [
    { value: "none", label: "（使わない）" },
    ...Array.from({ length: width }, (_, i) => {
      const name = header[i]?.trim() || table[headerRow]?.[i]?.trim() || ""
      return { value: String(i), label: `${columnLetter(i)} 列${name ? `：${name.slice(0, 20)}` : ""}` }
    }),
  ]

  const toReview = () => {
    const built = buildRows(table, headerRow, columns, fallback, activeCategories)
    if (!built.length) return setError("見出しより下に取り込める行がありません")
    setError(null)
    setRows(built)
    setEditing(null)
    setStep("review")
  }

  const update = (rowNo: number, patch: Partial<ImportRow>) => setRows((rs) => rs.map((r) => (r.rowNo === rowNo ? { ...r, ...patch } : r)))

  const submit = async () => {
    setBusy(true)
    const res = await actions.importLiveQuestions(
      ready.flatMap((r) => toImportInputs(r, fileName)),
      fileName,
    )
    setBusy(false)
    if (!res) return
    setResult(res)
    setStep("done")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Excel から問題を登録</DialogTitle>
          <DialogDescription>
            {step === "file" && "Excel（.xlsx）か CSV を選んでください。列の並びがテンプレートと違っても、次の画面で合わせられます。"}
            {step === "map" && `${fileName}：見出しの行と、それぞれの項目がどの列かを確かめてください。`}
            {step === "review" && "1 行ずつ確かめて、必要なら直してから登録します。問題がある行は登録しません。すべて「下書き」で登録します。"}
            {step === "done" && "登録が終わりました。下書きは問題ライブラリに並びます。ファクトチェックは問題の画面の「再検証」から行ってください。"}
          </DialogDescription>
        </DialogHeader>

        {step === "file" && (
          <div className="flex flex-col gap-4">
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center text-sm transition-colors hover:bg-accent/40",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden />
              <span className="font-medium">{busy ? "読み込み中…" : "ファイルを選ぶ"}</span>
              <span className="text-xs text-muted-foreground">.xlsx・.csv（ファイルはこのブラウザの中だけで読み込みます）</span>
              <input
                type="file"
                accept=".xlsx,.csv,.tsv,.txt"
                className="sr-only"
                aria-label="取り込むファイル"
                onChange={(e) => {
                  void onFile(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>列：媒体（X・Discord・両方）／問題文／選択肢A・B・C／正解（A・B・C）／解説／難易度・分類・題材・出題日・メモ（任意）</span>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(activeCategories)}>
                <Download />
                テンプレートをダウンロード
              </Button>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {sheets.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="import-sheet">シート</Label>
                  <SimpleSelect
                    id="import-sheet"
                    value={String(sheetIdx)}
                    onChange={(v) => {
                      setSheetIdx(Number(v))
                      applyHeader(sheets[Number(v)].rows, guessHeaderRow(sheets[Number(v)].rows))
                    }}
                    options={sheets.map((s, i) => ({ value: String(i), label: s.name }))}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-header">見出しの行</Label>
                <Input
                  id="import-header"
                  type="number"
                  min={0}
                  max={Math.max(1, table.length)}
                  value={headerRow}
                  onChange={(e) => applyHeader(table, Math.max(0, Math.min(table.length, Number(e.target.value) || 0)))}
                />
                <span className="text-xs text-muted-foreground">0 にすると見出しなし（1 行目から問題）</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-fallback">媒体の列が空のとき</Label>
                <SimpleSelect id="import-fallback" value={fallback} onChange={setFallback} options={PLATFORM_OPTIONS} />
              </div>
            </div>

            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-medium">列の割り当て</legend>
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`import-col-${f.key}`}>
                    {f.label}
                    {f.required ? <span className="text-destructive"> *</span> : <span className="text-xs font-normal text-muted-foreground">（任意）</span>}
                  </Label>
                  <SimpleSelect
                    id={`import-col-${f.key}`}
                    value={columns[f.key] === null ? "none" : String(columns[f.key])}
                    onChange={(v) => setColumns((c) => ({ ...c, [f.key as FieldKey]: v === "none" ? null : Number(v) }))}
                    options={columnOptions}
                  />
                </div>
              ))}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">ファイルの先頭（見出しの行は色付き）</span>
              <div className="max-h-56 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="w-10 px-2 py-1 text-right font-normal text-muted-foreground">行</th>
                      {Array.from({ length: width }, (_, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                          {columnLetter(i)}
                          {Object.entries(columns)
                            .filter(([, c]) => c === i)
                            .map(([k]) => (
                              <span key={k} className="ml-1 rounded bg-primary/15 px-1 font-normal text-primary">
                                {FIELDS.find((f) => f.key === k)?.label}
                              </span>
                            ))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.slice(0, 8).map((r, ri) => (
                      <tr key={ri} className={cn("border-t", ri + 1 === headerRow && "bg-primary/10 font-medium")}>
                        <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{ri + 1}</td>
                        {Array.from({ length: width }, (_, ci) => (
                          <td key={ci} className="max-w-48 truncate px-2 py-1" title={r[ci]}>
                            {r[ci]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {missing.length > 0 && <p className="text-xs text-destructive">{missing.map((f) => f.label).join("・")} の列を選んでください</p>}
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm" aria-live="polite">
              登録できる問題 <span className="font-semibold tabular-nums">{readyCount}</span> 問（{ready.length} 行）
              {errorCount > 0 && <span className="text-destructive">・登録できない行 {errorCount} 行</span>}
              {rows.some((r) => !r.include) && <span className="text-muted-foreground">・外した行 {rows.filter((r) => !r.include).length} 行</span>}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">登録する</span>
                  </TableHead>
                  <TableHead className="w-12 text-right">行</TableHead>
                  <TableHead className="w-20">媒体</TableHead>
                  <TableHead>問題文</TableHead>
                  <TableHead className="w-12">正解</TableHead>
                  <TableHead className="w-28">難易度・分類</TableHead>
                  <TableHead className="w-24">出題日</TableHead>
                  <TableHead className="w-56">確認</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">直す</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const err = errors.get(r.rowNo)
                  return (
                    <ReviewRow
                      key={r.rowNo}
                      row={r}
                      error={err ?? null}
                      warning={warnings.get(r.rowNo) ?? null}
                      editing={editing === r.rowNo}
                      onEdit={() => setEditing(editing === r.rowNo ? null : r.rowNo)}
                      onChange={(patch) => update(r.rowNo, patch)}
                      categories={activeCategories}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <span className="font-semibold tabular-nums">{result.saved.length}</span> 問を下書きで登録しました
              {result.saved.length > 0 && (
                <span className="text-muted-foreground">（{result.saved[0].id}{result.saved.length > 1 ? ` 〜 ${result.saved[result.saved.length - 1].id}` : ""}）</span>
              )}
            </p>
            {result.rejected.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <span className="font-medium text-destructive">登録できなかった問題 {result.rejected.length} 件</span>
                <ul className="flex flex-col gap-0.5 text-xs">
                  {result.rejected.map((x) => {
                    const [rowNo, p] = x.ref.split(":")
                    return (
                      <li key={x.ref}>
                        {rowNo} 行目（{p === "discord" ? "Discord" : "X"}）：{x.reason}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === "map" || step === "review" ? (
            <Button variant="ghost" onClick={() => setStep(step === "map" ? "file" : "map")} disabled={busy}>
              <ArrowLeft />
              {step === "map" ? "ファイルを選び直す" : "列の割り当てに戻る"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {step === "done" ? (
              <>
                <Button variant="outline" onClick={reset}>
                  続けて取り込む
                </Button>
                <Button onClick={() => (reset(), onOpenChange(false))}>閉じる</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => (reset(), onOpenChange(false))} disabled={busy}>
                  キャンセル
                </Button>
                {step === "map" && (
                  <Button onClick={toReview} disabled={missing.length > 0}>
                    確認へ進む
                  </Button>
                )}
                {step === "review" && (
                  <Button onClick={submit} disabled={busy || readyCount === 0}>
                    {busy ? "登録中…" : `${readyCount} 問を下書きで登録`}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewRow({
  row,
  error,
  warning,
  editing,
  onEdit,
  onChange,
  categories,
}: {
  row: ImportRow
  error: string | null
  warning: string | null
  editing: boolean
  onEdit: () => void
  onChange: (patch: Partial<ImportRow>) => void
  categories: Category[]
}) {
  const categoryLabel = row.category ? categories.find((c) => c.id === row.category)?.name ?? row.category : null
  const id = `import-row-${row.rowNo}`
  return (
    <>
      <TableRow className={cn(!row.include && "opacity-50")}>
        <TableCell>
          <Checkbox checked={row.include} onCheckedChange={(c) => onChange({ include: !!c })} aria-label={`${row.rowNo} 行目を登録する`} />
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{row.rowNo}</TableCell>
        <TableCell>{row.platform ? PLATFORM_SHORT[row.platform] : <span className="text-destructive">{row.platformRaw || "—"}</span>}</TableCell>
        <TableCell className="max-w-0">
          <span className="line-clamp-2 whitespace-normal">{row.text || <span className="text-destructive">（空）</span>}</span>
        </TableCell>
        <TableCell>{row.answer ?? <span className="text-destructive">{row.answerRaw || "—"}</span>}</TableCell>
        <TableCell className="text-xs">
          {row.difficultyError || row.categoryError ? (
            <span className="text-destructive">?</span>
          ) : (
            <span className="text-muted-foreground">
              {row.difficulty || categoryLabel ? `${row.difficulty ? DIFFICULTY_LABEL[row.difficulty] : "—"}・${categoryLabel ?? "—"}` : "未設定"}
            </span>
          )}
        </TableCell>
        <TableCell className="tabular-nums">{row.plannedDate || (row.dateError ? <span className="text-destructive">?</span> : "—")}</TableCell>
        <TableCell className="whitespace-normal">
          {!row.include ? (
            <StatusBadge tone="muted" label="外した" hideIcon />
          ) : error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : (
            <div className="flex flex-col gap-1">
              <StatusBadge tone="success" label="登録できます" />
              {warning && <span className="text-xs text-warning">{warning}</span>}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-expanded={editing} aria-controls={id} aria-label={`${row.rowNo} 行目を直す`}>
            <Pencil />
          </Button>
        </TableCell>
      </TableRow>
      {editing && (
        <TableRow id={id} className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={9} className="whitespace-normal">
            <div className="grid gap-3 py-2 sm:grid-cols-6">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={`${id}-platform`}>媒体</Label>
                <SimpleSelect id={`${id}-platform`} value={row.platform ?? "x"} onChange={(v) => onChange({ platform: v })} options={PLATFORM_OPTIONS} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={`${id}-date`}>出題日（任意）</Label>
                <Input id={`${id}-date`} type="date" value={row.plannedDate} onChange={(e) => onChange({ plannedDate: e.target.value, dateError: undefined })} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor={`${id}-answer`}>正解</Label>
                <SimpleSelect
                  id={`${id}-answer`}
                  value={row.answer ?? "A"}
                  onChange={(v) => onChange({ answer: v as ChoiceLabel })}
                  options={CHOICE_LABELS.map((l, i) => ({ value: l, label: `${l}：${row.choices[i] || "（空）"}` }))}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label htmlFor={`${id}-difficulty`}>難易度（任意）</Label>
                <SimpleSelect<Difficulty>
                  id={`${id}-difficulty`}
                  value={row.difficulty ?? "auto"}
                  onChange={(v) => onChange({ difficulty: v === "auto" ? null : v, difficultyError: undefined })}
                  options={[{ value: "auto", label: "未設定" }, ...(["beginner", "intermediate", "advanced"] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))]}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label htmlFor={`${id}-category`}>分類（任意）</Label>
                <SimpleSelect
                  id={`${id}-category`}
                  value={row.category ?? "none"}
                  onChange={(v) => onChange({ category: v === "none" ? null : v, categoryError: undefined })}
                  options={[{ value: "none", label: "未設定" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-6">
                <Label htmlFor={`${id}-topic`}>題材（任意）</Label>
                <Input id={`${id}-topic`} value={row.topic} maxLength={TOPIC_MAX} onChange={(e) => onChange({ topic: e.target.value })} placeholder="例：木星" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-6">
                <Label htmlFor={`${id}-text`}>問題文</Label>
                <Textarea id={`${id}-text`} rows={2} value={row.text} onChange={(e) => onChange({ text: e.target.value })} />
              </div>
              {CHOICE_LABELS.map((l, i) => (
                <div key={l} className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`${id}-c${l}`}>選択肢{l}</Label>
                  <Input
                    id={`${id}-c${l}`}
                    value={row.choices[i]}
                    onChange={(e) => onChange({ choices: row.choices.map((c, j) => (j === i ? e.target.value : c)) })}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5 sm:col-span-6">
                <Label htmlFor={`${id}-exp`}>解説</Label>
                <Textarea id={`${id}-exp`} rows={3} value={row.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-6">
                <Label htmlFor={`${id}-note`}>メモ（任意）</Label>
                <Input id={`${id}-note`} value={row.note} onChange={(e) => onChange({ note: e.target.value })} />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
