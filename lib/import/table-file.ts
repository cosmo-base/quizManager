// Excel（.xlsx）・CSV をブラウザの中で表（文字列の 2 次元配列）に読み込む。ファイルはどこにも送らない。
// .xlsx は ZIP の中の XML なので、展開（fflate）とブラウザの DOMParser だけで読む。書式（日付の表示形式など）は見ない：
// 日付のセルは Excel のシリアル値（数値）で入ってくるので、出題日の列だけ取り込み側で日付に直す。
import { unzipSync, strFromU8 } from "fflate"

export interface TableSheet {
  name: string
  rows: string[][]
}

/** 読み込む行数の上限（これより下は読まない） */
export const MAX_ROWS = 1000

export async function readTableFile(file: File): Promise<TableSheet[]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const name = file.name.toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return [{ name: file.name, rows: parseCsv(decodeText(buf), name.endsWith(".tsv") ? "\t" : undefined) }]
  }
  if (name.endsWith(".xls")) throw new Error("古い形式（.xls）は読めません。Excel で .xlsx として保存し直してください")
  return readXlsx(buf)
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** UTF-8（BOM の有無を問わない）で読めなければ Shift_JIS（日本語版 Excel の CSV）として読む */
function decodeText(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "")
  } catch {
    return new TextDecoder("shift_jis").decode(buf)
  }
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0)
  const d = delimiter ?? (firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"' && cell === "") quoted = true
    else if (c === d) {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      if (rows.length >= MAX_ROWS) return rows
    } else cell += c
  }
  if (cell !== "" || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// .xlsx
// ---------------------------------------------------------------------------

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

function xml(files: Record<string, Uint8Array>, path: string): Document | null {
  const f = files[path]
  return f ? new DOMParser().parseFromString(strFromU8(f), "application/xml") : null
}

/** 子孫の要素（名前空間の接頭辞を無視して local name で探す） */
function els(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagNameNS("*", local))
}

/** <si> や <is> の中の文字（ふりがな <rPh> は除く） */
function richText(el: Element): string {
  return els(el, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("")
}

/** "BC12" → 列番号 54（0 始まり） */
function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, "")
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function readXlsx(buf: Uint8Array): TableSheet[] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buf, { filter: (f) => (f.name.startsWith("xl/") && f.name.endsWith(".xml")) || f.name.endsWith(".rels") })
  } catch {
    throw new Error("Excel ファイル（.xlsx）として読めませんでした")
  }
  const workbook = xml(files, "xl/workbook.xml")
  if (!workbook) throw new Error("Excel ファイル（.xlsx）として読めませんでした")

  const rels = xml(files, "xl/_rels/workbook.xml.rels")
  const target: Record<string, string> = {}
  if (rels) for (const r of els(rels, "Relationship")) target[r.getAttribute("Id") ?? ""] = r.getAttribute("Target") ?? ""

  const sharedDoc = xml(files, "xl/sharedStrings.xml")
  const shared = sharedDoc ? els(sharedDoc, "si").map(richText) : []

  return els(workbook, "sheet").flatMap((s) => {
    const rid = s.getAttributeNS(REL_NS, "id") ?? s.getAttribute("r:id") ?? ""
    const t = target[rid]
    if (!t) return []
    const path = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`
    const doc = xml(files, path)
    if (!doc) return []
    return [{ name: s.getAttribute("name") ?? path, rows: sheetRows(doc, shared) }]
  })
}

function sheetRows(doc: Document, shared: string[]): string[][] {
  const rows: string[][] = []
  for (const r of els(doc, "row")) {
    const rowNo = Number(r.getAttribute("r")) || rows.length + 1
    if (rowNo > MAX_ROWS) break
    const cells: string[] = []
    for (const c of Array.from(r.children).filter((e) => e.localName === "c")) {
      const ref = c.getAttribute("r")
      const col = ref ? columnIndex(ref) : cells.length
      const type = c.getAttribute("t")
      const v = Array.from(c.children).find((e) => e.localName === "v")?.textContent ?? ""
      let value: string
      if (type === "s") value = shared[Number(v)] ?? ""
      else if (type === "inlineStr") {
        const is = Array.from(c.children).find((e) => e.localName === "is")
        value = is ? richText(is) : ""
      } else if (type === "b") value = v === "1" ? "TRUE" : "FALSE"
      else value = v
      while (cells.length < col) cells.push("")
      cells[col] = value
    }
    // 空の行も行番号どおりに入れる（見出しの行番号が Excel の表示と合うように）
    while (rows.length < rowNo - 1) rows.push([])
    rows.push(cells)
  }
  return rows
}

/** 列番号（0 始まり）→ "A"・"B"…"AA" */
export function columnLetter(i: number): string {
  let s = ""
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
