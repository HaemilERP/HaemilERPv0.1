import ExcelJS from "exceljs/dist/exceljs.min.js";

// -----------------------
// Generic helpers
// -----------------------

export function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function hexToARGB(hex) {
  // ExcelJS expects ARGB (AARRGGBB)
  const h = String(hex || "").replace("#", "").trim();
  if (h.length === 6) return `FF${h.toUpperCase()}`;
  if (h.length === 8) return h.toUpperCase();
  return "FF009781";
}

function applyThinBorder(cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function setColumnWidths(ws, colWidths) {
  if (!Array.isArray(colWidths)) return;
  colWidths.forEach((w, i) => {
    if (!w) return;
    ws.getColumn(i + 1).width = Number(w) || 12;
  });
}

function addTitle(ws, title, colCount) {
  const cols = Math.max(1, Number(colCount) || 1);
  const lastCol = ws.getColumn(cols).letter;

  // Title row
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 16 };
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  // Spacer row
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getRow(2).height = 10;
}

function styleHeaderRow(ws, headerRowNumber, colCount, headerHex) {
  const fillArgb = hexToARGB(headerHex);
  const r = ws.getRow(headerRowNumber);
  r.height = 20;

  for (let c = 1; c <= colCount; c += 1) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    applyThinBorder(cell);
  }
}

function styleBody(ws, fromRow, toRow, colCount) {
  for (let r = fromRow; r <= toRow; r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= colCount; c += 1) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      applyThinBorder(cell);
    }
  }
}

function addDropdownValidation(ws, colIdx, fromRow, toRow, options) {
  if (!Array.isArray(options) || options.length === 0) return;

  // Excel list validation formula: "A,B,C"
  // Escape double-quotes by doubling them (rare for our options).
  const list = options.map((x) => String(x).replace(/"/g, '""')).join(",");
  const formula = `"${list}"`;

  for (let r = fromRow; r <= toRow; r += 1) {
    const cell = ws.getRow(r).getCell(colIdx);
    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "값 선택",
      error: "목록에서 값을 선택하세요.",
      formulae: [formula],
    };
  }
}

function normalizeHeader(v) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function idxOfHeader(headers, aliases) {
  const set = new Set((aliases || []).map(normalizeHeader));
  return (headers || []).findIndex((h) => set.has(normalizeHeader(h)));
}

function isEmptyRow(row) {
  return (row || []).every((c) => String(c ?? "").trim() === "");
}

export function parseBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (["true", "1", "y", "yes", "유", "예", "o"].includes(s)) return true;
  if (["false", "0", "n", "no", "무", "아니오", "x"].includes(s)) return false;
  return true;
}

export function parseNumberOrNull(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseNumberRequired(v) {
  const s = String(v ?? "").trim();
  if (!s) return { ok: false, value: null };
  const n = Number(s);
  return { ok: Number.isFinite(n), value: Number.isFinite(n) ? n : null };
}

// Normalize various date inputs to YYYY-MM-DD (best-effort)
export function normalizeYMD(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY.MM.DD or YYYY/MM/DD
  const m1 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m1) {
    const yyyy = m1[1];
    const mm = String(m1[2]).padStart(2, "0");
    const dd = String(m1[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Excel serial number (very common) - treat as days from 1899-12-30
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + n * 24 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: try Date parsing
  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) {
    const yyyy = d2.getFullYear();
    const mm = String(d2.getMonth() + 1).padStart(2, "0");
    const dd = String(d2.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return s;
}

export function parseDateRequired(v) {
  const y = normalizeYMD(v);
  if (!y) return { ok: false, value: "" };
  // allow only YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return { ok: false, value: y };
  return { ok: true, value: y };
}

export function parseIdList(v) {
  const s = String(v ?? "").trim();
  if (!s) return [];
  return s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// -----------------------
// Download helpers
// -----------------------

async function downloadWorkbookBuffer(filename, buffer) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadWorkbook({ filename, sheets }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  (sheets || []).forEach((s) => {
    const ws = wb.addWorksheet(s.name || "Sheet1");

    const aoa = Array.isArray(s.aoa) ? s.aoa : [[]];
    aoa.forEach((row, i) => ws.addRow(row));

    setColumnWidths(ws, s.colWidths);
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(filename, buf);
}

export async function downloadAOAXlsx({ filename, sheetName = "Sheet1", aoa, colWidths }) {
  return downloadWorkbook({
    filename,
    sheets: [{ name: sheetName, aoa, colWidths }],
  });
}


function cellValueToString(cell) {
  const v = cell?.value;

  if (v === null || v === undefined) return "";

  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);

    if (Object.prototype.hasOwnProperty.call(v, "result")) {
      const res = v.result;
      return res === null || res === undefined ? "" : String(res);
    }

    if (Object.prototype.hasOwnProperty.call(v, "text")) {
      return v.text === null || v.text === undefined ? "" : String(v.text);
    }

    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => t?.text || "").join("");
    }

    try {
      return String(v);
    } catch {
      return "";
    }
  }

  return String(v);
}

export async function readFirstSheetAOA(file) {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const ws = wb.worksheets?.[0];
  if (!ws) return [];

  // Find max columns in first ~200 rows (avoid huge loops)
  let maxCol = 0;
  const maxScanRows = Math.min(ws.rowCount || 0, 200);
  for (let r = 1; r <= maxScanRows; r += 1) {
    const row = ws.getRow(r);
    maxCol = Math.max(maxCol, row.actualCellCount || row.cellCount || 0);
  }
  maxCol = Math.max(maxCol, 1);

  const aoa = [];
  for (let r = 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= maxCol; c += 1) {
      const cell = row.getCell(c);
      // Prefer text for dates/formulas etc.
      arr.push(cellValueToString(cell));
    }
    aoa.push(arr);
  }

  // Trim trailing empty rows
  while (aoa.length && isEmptyRow(aoa[aoa.length - 1])) aoa.pop();

  return aoa;
}

// -----------------------
// Templates (Korean headers; ID & HACCP in uppercase English)
// -----------------------

const HEADER_COLOR = "#009781";
const VALIDATION_ROWS_FROM = 4;   // after title(1), spacer(2), header(3)
const VALIDATION_ROWS_TO = 500;   // enough for typical bulk input

function buildTemplateSheet(wb, { title, headers, example, colWidths, validations }) {
  const ws = wb.addWorksheet("입력");

  const colCount = headers.length;

  addTitle(ws, title, colCount);

  // Header row at row 3
  ws.addRow(headers);
  // Example row at row 4
  if (Array.isArray(example)) ws.addRow(example);

  setColumnWidths(ws, colWidths);

  styleHeaderRow(ws, 3, colCount, HEADER_COLOR);
  styleBody(ws, 4, Math.max(4, ws.rowCount), colCount);

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 3 }];

  // Validations: [{ colName, options }]
  (validations || []).forEach((v) => {
    const idx = headers.findIndex((h) => h === v.colName);
    if (idx >= 0) {
      addDropdownValidation(ws, idx + 1, VALIDATION_ROWS_FROM, VALIDATION_ROWS_TO, v.options);
    }
  });

  // Add guide sheet (simple)
  const guide = wb.addWorksheet("설명");
  guide.addRow(["사용방법"]);
  guide.addRow(["- 4행부터 데이터를 입력하세요. (1행: 제목 / 3행: 헤더)"]);
  guide.addRow(["- ID가 있으면 해당 ID를 수정(PATCH), 없으면 신규 생성(POST)합니다."]);
  guide.addRow(["- 선택지가 있는 항목은 드롭다운으로 선택하세요."]);
  guide.getColumn(1).width = 120;

  return wb;
}


// -----------------------
// Styled list exports (match each template format)
// -----------------------

function buildDataSheet(wb, { sheetName = "목록", title, headers, rows, colWidths, validations }) {
  const ws = wb.addWorksheet(sheetName);

  const colCount = headers.length;
  addTitle(ws, title, colCount);

  ws.addRow(headers);

  (rows || []).forEach((r) => ws.addRow(Array.isArray(r) ? r : []));

  setColumnWidths(ws, colWidths);

  // Header row at row 3 (after title+spacer)
  styleHeaderRow(ws, 3, colCount, HEADER_COLOR);

  // Body from row 4 to end
  const lastRow = Math.max(4, ws.rowCount || 4);
  styleBody(ws, 4, lastRow, colCount);

  ws.views = [{ state: "frozen", ySplit: 3 }];

  // Optional dropdown validations (same as template)
  (validations || []).forEach((v) => {
    const idx = headers.findIndex((h) => h === v.colName);
    if (idx >= 0) {
      addDropdownValidation(ws, idx + 1, 4, Math.max(4, Math.min(lastRow + 50, VALIDATION_ROWS_TO)), v.options);
    }
  });

  return ws;
}

export async function downloadCustomerListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = ["ID", "고객사명", "농장명", "납고가능 일수", "유통기한"];
  buildDataSheet(wb, {
    sheetName: "고객사",
    title: "고객사 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 24, 34, 16, 14],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_고객사목록_${todayYMD()}.xlsx`, buf);
}

export async function downloadFarmListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = ["ID", "농장명", "난각번호", "농장유형", "무항생제", "HACCP", "유기농"];
  buildDataSheet(wb, {
    sheetName: "농장",
    title: "농장 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 22, 14, 14, 12, 10, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "무항생제", options: ["유", "무"] },
      { colName: "HACCP", options: ["유", "무"] },
      { colName: "유기농", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_농장목록_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = [
    "ID",
    "제품명",
    "고객사ID",
    "계란수",
    "사육번호",
    "농장유형",
    "계란등급",
    "난중",
    "가공여부",
    "납고가능 일수",
    "유통기한",
    "무항생제",
    "HACCP",
    "유기농",
  ];

  buildDataSheet(wb, {
    sheetName: "제품",
    title: "제품 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 22, 12, 10, 12, 14, 12, 12, 12, 14, 12, 12, 10, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "계란등급", options: ["A", "B"] },
      { colName: "난중", options: ["왕란", "특란", "대란", "중란", "소란"] },
      { colName: "가공여부", options: ["생란", "구운란"] },
      { colName: "무항생제", options: ["유", "무"] },
      { colName: "HACCP", options: ["유", "무"] },
      { colName: "유기농", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품목록_${todayYMD()}.xlsx`, buf);
}

// -----------------------
// Inventory list exports
// -----------------------

export async function downloadEggLotListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = [
    "ID",
    "농장ID",
    "입고일",
    "난각번호",
    "사육번호",
    "농장유형",
    "주령(주)",
    "가공여부",
    "난중",
    "산란일",
    "등급",
    "위치",
    "수량",
    "메모",
    "활성여부",
  ];

  buildDataSheet(wb, {
    sheetName: "계란재고",
    title: "계란재고 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 12, 14, 12, 12, 14, 12, 12, 10, 14, 10, 18, 10, 26, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "가공여부", options: ["구운란", "생란", "액란", "기타"] },
      { colName: "난중", options: ["왕란", "특란", "대란", "중란", "소란"] },
      { colName: "활성여부", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_계란재고목록_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductLotListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = ["ID", "제품ID", "계란재고ID", "수량", "위치", "메모", "활성여부"];

  buildDataSheet(wb, {
    sheetName: "제품재고",
    title: "제품재고 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 12, 12, 10, 18, 26, 10],
    validations: [{ colName: "활성여부", options: ["유", "무"] }],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품재고목록_${todayYMD()}.xlsx`, buf);
}

export async function downloadEggLotHistoryListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = [
    "ID",
    "계란재고ID",
    "변경유형",
    "변경전",
    "변경후",
    "변경수량",
    "변경자",
    "변경일시",
    "메모",
  ];

  buildDataSheet(wb, {
    sheetName: "계란재고변경",
    title: "계란재고 변경내역 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 12, 12, 10, 10, 10, 16, 20, 40],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_계란재고변경내역_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductLotHistoryListXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Haemil ERP";
  wb.created = new Date();

  const headers = [
    "ID",
    "제품재고ID",
    "변경유형",
    "변경전",
    "변경후",
    "변경수량",
    "변경자",
    "변경일시",
    "메모",
  ];

  buildDataSheet(wb, {
    sheetName: "제품재고변경",
    title: "제품재고 변경내역 엑셀 출력",
    headers,
    rows,
    colWidths: [10, 12, 12, 10, 10, 10, 16, 20, 40],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품재고변경내역_${todayYMD()}.xlsx`, buf);
}
export async function downloadCustomerTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "고객사정보 입력 서식",
    headers: ["ID", "고객사명", "농장명", "납고가능 일수", "유통기한"],
    colWidths: [10, 24, 34, 16, 14],
    validations: [],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_고객사_입력서식_${todayYMD()}.xlsx`, buf);
}

export async function downloadFarmTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "농장정보 입력 서식",
    headers: ["ID", "농장명", "난각번호", "농장유형", "무항생제", "HACCP", "유기농"],
    colWidths: [10, 22, 14, 14, 12, 10, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "무항생제", options: ["유", "무"] },
      { colName: "HACCP", options: ["유", "무"] },
      { colName: "유기농", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_농장_입력서식_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "제품정보 입력 서식",
    headers: ["ID", "제품명", "고객사ID", "계란수", "사육번호", "농장유형", "계란등급", "난중", "가공여부", "납고가능 일수", "유통기한", "무항생제", "HACCP", "유기농"],
    colWidths: [10, 22, 12, 10, 12, 14, 12, 12, 12, 14, 12, 12, 10, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "계란등급", options: ["A", "B"] },
      { colName: "난중", options: ["왕란", "특란", "대란", "중란", "소란"] },
      { colName: "가공여부", options: ["생란", "구운란"] },
      { colName: "무항생제", options: ["유", "무"] },
      { colName: "HACCP", options: ["유", "무"] },
      { colName: "유기농", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품_입력서식_${todayYMD()}.xlsx`, buf);
}

// -----------------------
// Inventory templates
// -----------------------

export async function downloadEggLotTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "계란재고(EggLot) 입력 서식",
    headers: [
      "ID",
      "농장ID",
      "입고일",
      "난각번호",
      "사육번호",
      "농장유형",
      "주령(주)",
      "가공여부",
      "난중",
      "산란일",
      "등급",
      "위치",
      "수량",
      "메모",
      "활성여부",
    ],
    colWidths: [10, 12, 14, 12, 12, 14, 12, 12, 10, 14, 10, 18, 10, 26, 10],
    validations: [
      { colName: "농장유형", options: ["일반농장", "동물복지농장"] },
      { colName: "가공여부", options: ["구운란", "생란", "액란", "기타"] },
      { colName: "난중", options: ["왕란", "특란", "대란", "중란", "소란"] },
      { colName: "활성여부", options: ["유", "무"] },
    ],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_계란재고_입력서식_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductLotTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "제품재고(ProductLot) 입력 서식",
    headers: ["ID", "제품ID", "계란재고ID", "수량", "위치", "메모", "활성여부"],
    colWidths: [10, 12, 12, 10, 18, 26, 10],
    validations: [{ colName: "활성여부", options: ["유", "무"] }],
  });

  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품재고_입력서식_${todayYMD()}.xlsx`, buf);
}

// 변경내역은 입력(업로드) 없이, 메모 업데이트용 템플릿만 제공(선택)
export async function downloadEggLotHistoryMemoTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "계란재고 변경내역 메모 입력 서식",
    headers: ["ID", "메모"],
    colWidths: [10, 40],
    validations: [],
  });
  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_계란재고변경내역_메모서식_${todayYMD()}.xlsx`, buf);
}

export async function downloadProductLotHistoryMemoTemplate() {
  const wb = new ExcelJS.Workbook();
  buildTemplateSheet(wb, {
    title: "제품재고 변경내역 메모 입력 서식",
    headers: ["ID", "메모"],
    colWidths: [10, 40],
    validations: [],
  });
  const buf = await wb.xlsx.writeBuffer();
  await downloadWorkbookBuffer(`HaemilERP_제품재고변경내역_메모서식_${todayYMD()}.xlsx`, buf);
}

// -----------------------
// Parsers (xlsx -> rows)
// -----------------------

export function parseCustomerAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  // Expect header row at row 3, but be tolerant:
  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID", "고객사id"]);
  const nameIdx = idxOfHeader(headers, ["customer_name", "고객사명"]);
  const farmsIdx = idxOfHeader(headers, ["available_farms", "농장명", "농장id", "농장", "farm_ids"]);
  const maxIdx = idxOfHeader(headers, ["max_laying_days", "납고가능 일수", "납고가능일수", "납고가능일"]);
  const expIdx = idxOfHeader(headers, ["expiration_date", "유통기한"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const id = parseNumberOrNull(row[idIdx]);
    const customer_name = String(row[nameIdx] ?? "").trim();
    const available_farms = parseIdList(row[farmsIdx]);
    const max = parseNumberRequired(row[maxIdx]);
    const exp = parseNumberRequired(row[expIdx]);

    const errs = [];
    if (!customer_name) errs.push("고객사명 필수");
    if (!max.ok) errs.push("납고가능 일수 숫자 필수");
    if (!exp.ok) errs.push("유통기한 숫자 필수");

    const parsed = {
      __rowNum: excelRowNum,
      ...(id != null ? { id } : {}),
      customer_name,
      available_farms,
      max_laying_days: max.value,
      expiration_date: exp.value,
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }
    out.rows.push(parsed);
  }

  return out;
}

export function parseFarmAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID", "농장id"]);
  const nameIdx = idxOfHeader(headers, ["farm_name", "농장명"]);
  const shellIdx = idxOfHeader(headers, ["shell_number", "난각번호"]);
  const typeIdx = idxOfHeader(headers, ["farm_type", "농장유형"]);
  const antiIdx = idxOfHeader(headers, ["antibiotic_free", "무항생제"]);
  const haccpIdx = idxOfHeader(headers, ["haccp", "HACCP"]);
  const orgIdx = idxOfHeader(headers, ["organic", "유기농"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const id = parseNumberOrNull(row[idIdx]);
    const farm_name = String(row[nameIdx] ?? "").trim();
    const shell_number = parseNumberOrNull(row[shellIdx]);
    const farm_type = String(row[typeIdx] ?? "").trim();
    const antibiotic_free = antiIdx >= 0 ? parseBool(row[antiIdx]) : undefined;
    const haccp = haccpIdx >= 0 ? parseBool(row[haccpIdx]) : undefined;
    const organic = orgIdx >= 0 ? parseBool(row[orgIdx]) : undefined;

    const errs = [];
    if (!farm_name) errs.push("농장명 필수");

    const parsed = {
      __rowNum: excelRowNum,
      ...(id != null ? { id } : {}),
      farm_name,
      ...(shell_number != null ? { shell_number } : {}),
      ...(farm_type ? { farm_type } : {}),
      ...(antibiotic_free !== undefined ? { antibiotic_free } : {}),
      ...(haccp !== undefined ? { haccp } : {}),
      ...(organic !== undefined ? { organic } : {}),
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }
    out.rows.push(parsed);
  }

  return out;
}

export function parseProductAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID", "제품id"]);
  const nameIdx = idxOfHeader(headers, ["product_name", "제품명"]);
  const customerIdx = idxOfHeader(headers, ["customer", "고객사id", "고객사ID"]);
  const eggCountIdx = idxOfHeader(headers, ["egg_count", "계란수"]);
  const breedIdx = idxOfHeader(headers, ["breeding_number", "사육번호"]);
  const farmTypeIdx = idxOfHeader(headers, ["farm_type", "농장유형"]);
  const gradeIdx = idxOfHeader(headers, ["egg_grade", "계란등급"]);
  const weightIdx = idxOfHeader(headers, ["egg_weight", "난중"]);
  const processIdx = idxOfHeader(headers, ["process_type", "가공여부"]);
  const maxIdx = idxOfHeader(headers, ["max_laying_days", "납고가능 일수"]);
  const expIdx = idxOfHeader(headers, ["expiration_date", "유통기한"]);
  const antiIdx = idxOfHeader(headers, ["antibiotic_free", "무항생제"]);
  const haccpIdx = idxOfHeader(headers, ["haccp", "HACCP"]);
  const orgIdx = idxOfHeader(headers, ["organic", "유기농"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;

    const id = parseNumberOrNull(row[idIdx]);
    const product_name = String(row[nameIdx] ?? "").trim();

    const customerReq = parseNumberRequired(row[customerIdx]);
    const eggCountReq = parseNumberRequired(row[eggCountIdx]);
    const breedReq = parseNumberRequired(row[breedIdx]);

    const farm_type = String(row[farmTypeIdx] ?? "").trim();
    const egg_grade = String(row[gradeIdx] ?? "").trim();
    const egg_weight = String(row[weightIdx] ?? "").trim();
    const process_type = String(row[processIdx] ?? "").trim();

    const max = parseNumberOrNull(row[maxIdx]);
    const exp = parseNumberOrNull(row[expIdx]);

    const antibiotic_free = antiIdx >= 0 ? parseBool(row[antiIdx]) : undefined;
    const haccp = haccpIdx >= 0 ? parseBool(row[haccpIdx]) : undefined;
    const organic = orgIdx >= 0 ? parseBool(row[orgIdx]) : undefined;

    const errs = [];
    if (!product_name) errs.push("제품명 필수");
    if (!customerReq.ok) errs.push("고객사ID 숫자 필수");
    if (!eggCountReq.ok) errs.push("계란수 숫자 필수");
    if (!breedReq.ok) errs.push("사육번호 숫자 필수");

    // Keep these required to match existing UI expectations (기존 템플릿은 필수)
    if (!farm_type) errs.push("농장유형 필수");
    if (!egg_grade) errs.push("계란등급 필수");
    if (!egg_weight) errs.push("난중 필수");
    if (!process_type) errs.push("가공여부 필수");

    const parsed = {
      __rowNum: excelRowNum,
      ...(id != null ? { id } : {}),
      product_name,
      customer: customerReq.value,
      egg_count: eggCountReq.value,
      breeding_number: breedReq.value,
      farm_type,
      egg_grade,
      egg_weight,
      process_type,
      ...(max != null ? { max_laying_days: max } : {}),
      ...(exp != null ? { expiration_date: exp } : {}),
      ...(antibiotic_free !== undefined ? { antibiotic_free } : {}),
      ...(haccp !== undefined ? { haccp } : {}),
      ...(organic !== undefined ? { organic } : {}),
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }
    out.rows.push(parsed);
  }

  return out;
}

// -----------------------
// Inventory parsers
// -----------------------

export function parseEggLotAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID"]);
  const farmIdx = idxOfHeader(headers, ["farm", "농장id", "농장ID"]);
  const recvIdx = idxOfHeader(headers, ["receiving_date", "입고일"]);
  const shellIdx = idxOfHeader(headers, ["shell_number", "난각번호"]);
  const breedIdx = idxOfHeader(headers, ["breeding_number", "사육번호"]);
  const farmTypeIdx = idxOfHeader(headers, ["farm_type", "농장유형"]);
  const ageIdx = idxOfHeader(headers, ["age_weeks", "주령", "주령(주)"]);
  const eggTypeIdx = idxOfHeader(headers, ["egg_type", "가공여부"]);
  const weightIdx = idxOfHeader(headers, ["egg_weight", "난중"]);
  const layingIdx = idxOfHeader(headers, ["laying_date", "산란일"]);
  const gradeIdx = idxOfHeader(headers, ["egg_grade", "등급"]);
  const locIdx = idxOfHeader(headers, ["location", "위치"]);
  const qtyIdx = idxOfHeader(headers, ["quantity", "수량"]);
  const memoIdx = idxOfHeader(headers, ["memo", "메모"]);
  const activeIdx = idxOfHeader(headers, ["is_active", "활성", "활성여부"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const id = parseNumberOrNull(row[idIdx]);
    const farmReq = parseNumberRequired(row[farmIdx]);
    const recvReq = parseDateRequired(row[recvIdx]);
    const layingReq = parseDateRequired(row[layingIdx]);
    const ageReq = parseNumberRequired(row[ageIdx]);
    const qtyReq = parseNumberRequired(row[qtyIdx]);

    const egg_weight = String(row[weightIdx] ?? "").trim();
    const egg_grade = String(row[gradeIdx] ?? "").trim();

    const shell_number = String(row[shellIdx] ?? "").trim();
    const breeding_number = parseNumberOrNull(row[breedIdx]);
    const farm_type = String(row[farmTypeIdx] ?? "").trim();
    const egg_type = String(row[eggTypeIdx] ?? "").trim();
    const location = String(row[locIdx] ?? "").trim();
    const memo = String(row[memoIdx] ?? "").trim();

    const activeRaw = String(row[activeIdx] ?? "").trim();
    const is_active = activeRaw ? parseBool(activeRaw) : undefined;

    const errs = [];
    if (!farmReq.ok) errs.push("농장ID 숫자 필수");
    if (!recvReq.ok) errs.push("입고일(YYYY-MM-DD) 필수");
    if (!layingReq.ok) errs.push("산란일(YYYY-MM-DD) 필수");
    if (!ageReq.ok) errs.push("주령(주) 숫자 필수");
    if (!egg_weight) errs.push("난중 필수");
    if (!egg_grade) errs.push("등급 필수");
    if (!qtyReq.ok) errs.push("수량 숫자 필수");

    const parsed = {
      __rowNum: excelRowNum,
      ...(id != null ? { id } : {}),
      farm: farmReq.value,
      receiving_date: recvReq.value,
      laying_date: layingReq.value,
      age_weeks: ageReq.value,
      egg_weight,
      egg_grade,
      ...(shell_number ? { shell_number } : {}),
      ...(breeding_number != null ? { breeding_number } : {}),
      ...(farm_type ? { farm_type } : {}),
      ...(egg_type ? { egg_type } : {}),
      ...(location ? { location } : {}),
      quantity: qtyReq.value,
      ...(memo ? { memo } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }

    out.rows.push(parsed);
  }

  return out;
}

export function parseProductLotAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID"]);
  const productIdx = idxOfHeader(headers, ["product", "제품id", "제품ID"]);
  const eggLotIdx = idxOfHeader(headers, ["egg_lot", "계란재고id", "계란재고ID"]);
  const qtyIdx = idxOfHeader(headers, ["quantity", "수량"]);
  const locIdx = idxOfHeader(headers, ["location", "위치"]);
  const memoIdx = idxOfHeader(headers, ["memo", "메모"]);
  const activeIdx = idxOfHeader(headers, ["is_active", "활성", "활성여부"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const id = parseNumberOrNull(row[idIdx]);
    const productReq = parseNumberRequired(row[productIdx]);
    const eggLotReq = parseNumberRequired(row[eggLotIdx]);
    const qtyReq = parseNumberRequired(row[qtyIdx]);
    const location = String(row[locIdx] ?? "").trim();
    const memo = String(row[memoIdx] ?? "").trim();
    const activeRaw = String(row[activeIdx] ?? "").trim();
    const is_active = activeRaw ? parseBool(activeRaw) : undefined;

    const errs = [];
    if (!productReq.ok) errs.push("제품ID 숫자 필수");
    if (!eggLotReq.ok) errs.push("계란재고ID 숫자 필수");
    if (!qtyReq.ok) errs.push("수량 숫자 필수");
    if (!location) errs.push("위치 필수");

    const parsed = {
      __rowNum: excelRowNum,
      ...(id != null ? { id } : {}),
      product: productReq.value,
      egg_lot: eggLotReq.value,
      quantity: qtyReq.value,
      location,
      ...(memo ? { memo } : {}),
      ...(is_active !== undefined ? { is_active } : {}),
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }
    out.rows.push(parsed);
  }

  return out;
}

export function parseHistoryMemoAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || aoa.length === 0) return out;

  const headerRowIdx = aoa.length >= 3 && !isEmptyRow(aoa[2]) ? 2 : 0;
  const headers = aoa[headerRowIdx] || [];

  const idIdx = idxOfHeader(headers, ["id", "ID"]);
  const memoIdx = idxOfHeader(headers, ["memo", "메모"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const idReq = parseNumberRequired(row[idIdx]);
    const memo = String(row[memoIdx] ?? "").trim();

    const errs = [];
    if (!idReq.ok) errs.push("ID 숫자 필수");
    if (!memo) errs.push("메모 필수");

    const parsed = {
      __rowNum: excelRowNum,
      id: idReq.value,
      memo,
    };

    if (errs.length) {
      out.errors.push({ row: excelRowNum, message: errs.join(" / ") });
      parsed.__invalid = true;
      parsed.__error = errs.join(" / ");
    }
    out.rows.push(parsed);
  }

  return out;
}
