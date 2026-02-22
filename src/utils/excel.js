import ExcelJS from "exceljs";
import { normalizeFarmType } from "./helpers";

export function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function normalizeHeader(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function isEmptyRow(row) {
  return !(row || []).some((v) => String(v ?? "").trim() !== "");
}

function idxOfHeader(headers, aliases) {
  const set = new Set((aliases || []).map(normalizeHeader));
  return (headers || []).findIndex((h) => set.has(normalizeHeader(h)));
}

function findHeaderRow(aoa, aliases) {
  const aliasSet = new Set((aliases || []).map(normalizeHeader));
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(8, aoa.length);
  for (let i = 0; i < limit; i += 1) {
    const row = aoa[i] || [];
    const score = row.reduce((sum, c) => {
      const ok = aliasSet.has(normalizeHeader(c));
      return sum + (ok ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function parseString(v) {
  return String(v ?? "").trim();
}

function normalizeEggGrade(v) {
  const s = parseString(v);
  if (!s || s === "무") return "무";
  if (s === "1") return "1";
  if (s === "1+") return "1+";
  if (s === "기타") return "기타";
  return "기타";
}

export function parseBool(v) {
  const s = parseString(v).toLowerCase();
  if (!s) return false;
  if (["true", "1", "y", "yes", "o", "유", "예"].includes(s)) return true;
  if (["false", "0", "n", "no", "x", "무", "아니오"].includes(s)) return false;
  return true;
}

function parseNumberOrNull(v) {
  const s = parseString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseNumberRequired(v) {
  const s = parseString(v);
  if (!s) return { ok: false, value: null };
  const n = Number(s);
  return { ok: Number.isFinite(n), value: Number.isFinite(n) ? n : null };
}

function normalizeYMD(v) {
  const s = parseString(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m1 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m1) {
    const yyyy = m1[1];
    const mm = String(m1[2]).padStart(2, "0");
    const dd = String(m1[3]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + n * 24 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) {
    const yyyy = d2.getFullYear();
    const mm = String(d2.getMonth() + 1).padStart(2, "0");
    const dd = String(d2.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return s;
}

function parseDateRequired(v) {
  const ymd = normalizeYMD(v);
  if (!ymd) return { ok: false, value: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { ok: false, value: ymd };
  return { ok: true, value: ymd };
}

function parseStringList(v) {
  return parseString(v)
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumberList(v) {
  return parseString(v)
    .split(/[\s,]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

function readCellValue(cell) {
  const value = cell?.value;
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "result")) return String(value.result ?? "");
    if (Object.prototype.hasOwnProperty.call(value, "text")) return String(value.text ?? "");
    if (Array.isArray(value.richText)) return value.richText.map((v) => v?.text || "").join("");
  }
  return String(value);
}

async function downloadWorkbook(filename, headers, rows, title = "") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("sheet1");

  if (title) ws.addRow([title]);
  if (title) ws.addRow([]);
  ws.addRow(headers || []);
  (rows || []).forEach((row) => ws.addRow(Array.isArray(row) ? row : []));

  ws.columns = (headers || []).map(() => ({ width: 22 }));

  const headerRowNumber = title ? 3 : 1;
  const headerRow = ws.getRow(headerRowNumber);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF009781" } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
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

export async function readFirstSheetAOA(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets?.[0];
  if (!ws) return [];

  let maxCol = 1;
  const scanRows = Math.min(ws.rowCount || 1, 250);
  for (let r = 1; r <= scanRows; r += 1) {
    const row = ws.getRow(r);
    maxCol = Math.max(maxCol, row.actualCellCount || row.cellCount || 1);
  }

  const aoa = [];
  for (let r = 1; r <= (ws.rowCount || 0); r += 1) {
    const row = ws.getRow(r);
    const arr = [];
    for (let c = 1; c <= maxCol; c += 1) {
      arr.push(readCellValue(row.getCell(c)));
    }
    aoa.push(arr);
  }
  while (aoa.length && isEmptyRow(aoa[aoa.length - 1])) aoa.pop();
  return aoa;
}

const CUSTOMER_HEADERS = [
  "고객사코드",
  "고객사명",
  "납품처",
  "사용농장",
  "최대산란일수",
  "유통기한",
];
const FARM_HEADERS = [
  "농장식별자",
  "농장명",
  "산란번호",
  "농장유형",
  "무항생제",
  "HACCP",
  "유기농",
];
const PRODUCT_HEADERS = [
  "제품식별자",
  "제품명",
  "고객사코드",
  "계란수",
  "사육번호목록",
  "농장유형",
  "계란등급",
  "중량",
  "계란유형",
  "최대산란일수",
  "유통기한",
  "무항생제",
  "HACCP",
  "유기농",
];
const CUSTOMER_HEADER_ALIASES = [
  ...CUSTOMER_HEADERS,
  "customer_code",
  "customer_name",
  "client",
  "available_farms",
  "max_laying_days",
  "expiration_date",
];
const FARM_HEADER_ALIASES = [
  ...FARM_HEADERS,
  "farm_id",
  "farm_name",
  "shell_number",
  "farm_type",
  "antibiotic_free",
  "haccp",
  "organic",
];
const PRODUCT_HEADER_ALIASES = [
  ...PRODUCT_HEADERS,
  "product_no",
  "product_name",
  "customer_code",
  "egg_count",
  "breeding_number",
  "farm_type",
  "egg_grade",
  "egg_weight",
  "process_type",
  "max_laying_days",
  "expiration_date",
  "antibiotic_free",
  "haccp",
  "organic",
];
const EGGLOT_HEADERS = [
  "계란재고식별자",
  "농장",
  "농장유형",
  "산란번호",
  "입고일",
  "산란일",
  "중량",
  "계란등급",
  "위치",
  "주령",
  "수량",
  "메모",
];
const EGGLOT_HEADER_ALIASES = [
  ...EGGLOT_HEADERS,
  "Egglot_no",
  "egg_lot_id",
  "farm_id",
  "receiving_date",
  "shell_number",
  "breeding_number",
  "farm_type",
  "age_weeks",
  "egg_weight",
  "laying_date",
  "egg_grade",
  "location",
  "quantity",
  "memo",
];

const PRODUCTLOT_HEADERS = [
  "제품재고식별자",
  "제품",
  "계란식별자",
  "수량",
  "위치",
  "공정일",
  "라인",
  "메모",
];
const PRODUCTLOT_HEADER_ALIASES = [
  ...PRODUCTLOT_HEADERS,
  "제품로트식별자",
  "ProductLot_no",
  "product_lot_id",
  "product_id",
  "product_no",
  "egg_lot_id",
  "Egglot_no",
  "quantity",
  "location",
  "process_day",
  "machine_line",
  "memo",
];
const HISTORY_MEMO_HEADER_ALIASES = [
  "id",
  "ID",
  "계란 변경내역ID",
  "제품 변경내역ID",
  "변경내역ID",
  "memo",
  "메모",
  "변경내역 메모",
];

export async function downloadCustomerTemplate() {
  await downloadWorkbook(
    `HaemilERP_customer_template_${todayYMD()}.xlsx`,
    CUSTOMER_HEADERS,
    [
      ["CUST001", "고객사A", "납품처A,납품처B", "FARM01,FARM02", 7, 45],
    ],
    "Customer Template"
  );
}

export async function downloadFarmTemplate() {
  await downloadWorkbook(
    `HaemilERP_farm_template_${todayYMD()}.xlsx`,
    FARM_HEADERS,
    [["FARM01", "농장A", "12", "일반농장", "유", "유", "무"]],
    "Farm Template"
  );
}

export async function downloadProductTemplate() {
  await downloadWorkbook(
    `HaemilERP_product_template_${todayYMD()}.xlsx`,
    PRODUCT_HEADERS,
    [
      [
        "PRD001",
        "제품A",
        "CUST001",
        10,
        "1,2",
        "일반농장",
        "무",
        "대란",
        "생란",
        7,
        30,
        "유",
        "유",
        "무",
      ],
    ],
    "Product Template"
  );
}

export async function downloadEggLotTemplate() {
  await downloadWorkbook(
    `HaemilERP_egglot_template_${todayYMD()}.xlsx`,
    EGGLOT_HEADERS,
    [
      [
        "",
        "FARM01",
        "일반농장",
        "12",
        "2026-02-22",
        "2026-02-21",
        "대란",
        "무",
        "창고A",
        40,
        300,
        "",
      ],
    ],
    "EggLot Template"
  );
}

export async function downloadProductLotTemplate() {
  await downloadWorkbook(
    `HaemilERP_productlot_template_${todayYMD()}.xlsx`,
    PRODUCTLOT_HEADERS,
    [["", "PRD001", "ELOT001", 120, "가공실A", "2026-02-22", "LINE-1", ""]],
    "ProductLot Template"
  );
}

export async function downloadEggLotHistoryMemoTemplate() {
  await downloadWorkbook(
    `HaemilERP_egglot_history_memo_template_${todayYMD()}.xlsx`,
    ["계란 변경내역ID", "변경내역 메모"],
    [[1, "메모 수정"]],
    "EggLotHistory Memo Template"
  );
}

export async function downloadProductLotHistoryMemoTemplate() {
  await downloadWorkbook(
    `HaemilERP_productlot_history_memo_template_${todayYMD()}.xlsx`,
    ["제품 변경내역ID", "변경내역 메모"],
    [[1, "메모 수정"]],
    "ProductLotHistory Memo Template"
  );
}

export async function downloadCustomerListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_customer_list_${todayYMD()}.xlsx`,
    CUSTOMER_HEADERS,
    rows,
    "Customer List"
  );
}

export async function downloadFarmListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_farm_list_${todayYMD()}.xlsx`,
    FARM_HEADERS,
    rows,
    "Farm List"
  );
}

export async function downloadProductListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_product_list_${todayYMD()}.xlsx`,
    PRODUCT_HEADERS,
    rows,
    "Product List"
  );
}

export async function downloadEggLotListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_egglot_list_${todayYMD()}.xlsx`,
    EGGLOT_HEADERS,
    rows,
    "EggLot List"
  );
}

export async function downloadProductLotListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_productlot_list_${todayYMD()}.xlsx`,
    PRODUCTLOT_HEADERS,
    rows,
    "ProductLot List"
  );
}

export async function downloadEggLotHistoryListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_egglot_history_${todayYMD()}.xlsx`,
    ["계란 변경내역ID", "계란재고", "유형", "변경전", "변경후", "변화량", "변경자", "변경일시", "변경내역 메모"],
    rows,
    "EggLot History"
  );
}

export async function downloadProductLotHistoryListXlsx(rows) {
  await downloadWorkbook(
    `HaemilERP_productlot_history_${todayYMD()}.xlsx`,
    ["제품 변경내역ID", "제품재고", "유형", "변경전", "변경후", "변화량", "변경자", "변경일시", "변경내역 메모"],
    rows,
    "ProductLot History"
  );
}

const ORDER_COMMON_FORM_HEADERS = [
  "거래처",
  "센터구분",
  "상품이름",
  "발주수량",
  "확정수량",
  "괴세구분",
  "단가",
  "공급가",
  "부가세",
  "출고일자",
  "비고",
];

const ORDER_COMMON_FORM_WIDTHS = [
  24.25, 24.25, 32.25, 24, 24, 18.63, 14.5, 13.5, 15, 16.88, 21.38,
];

function applyThinCellBorder(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
}

function toOrderFormDateCell(v) {
  const raw = parseString(v);
  if (!raw) return "";

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if (Number.isFinite(yyyy) && Number.isFinite(mm) && Number.isFinite(dd)) {
      return new Date(yyyy, mm - 1, dd);
    }
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function downloadOrderCommonFormXlsx(rows = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("상품목록");

  ws.addRow([]);
  ws.addRow(ORDER_COMMON_FORM_HEADERS);

  (rows || []).forEach((r) => {
    const row = Array.isArray(r) ? [...r] : [];
    row[9] = toOrderFormDateCell(row[9]);
    ws.addRow(row);
  });

  ws.columns = ORDER_COMMON_FORM_WIDTHS.map((width) => ({ width }));
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 32;

  const yellowCols = new Set([1, 2, 6, 7, 11]);
  for (let r = 2; r <= ws.rowCount; r += 1) {
    if (r >= 3) ws.getRow(r).height = 17.25;

    for (let c = 1; c <= ORDER_COMMON_FORM_HEADERS.length; c += 1) {
      const cell = ws.getRow(r).getCell(c);
      applyThinCellBorder(cell);
      cell.alignment = { horizontal: "center", vertical: "middle" };

      if (r === 2) {
        cell.font = {
          name: "Malgun Gothic",
          size: c === 4 || c === 5 ? 12 : 11,
          bold: false,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: yellowCols.has(c) ? "FFFFFF00" : "FFD0CECE" },
        };
      } else {
        cell.font = { name: "Malgun Gothic", size: 11, bold: false };
      }
    }
  }

  for (let r = 3; r <= ws.rowCount; r += 1) {
    ws.getRow(r).getCell(7).numFmt = "#,##0";
    ws.getRow(r).getCell(8).numFmt = "#,##0";
    ws.getRow(r).getCell(9).numFmt = "#,##0";
    ws.getRow(r).getCell(10).numFmt = "yyyy-mm-dd";
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `공통_발주양식_${todayYMD()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function parseCustomerAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, CUSTOMER_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];

  const codeIdx = idxOfHeader(headers, ["고객사코드", "customer_code", "customerid", "customer_id"]);
  const nameIdx = idxOfHeader(headers, ["고객사명", "customer_name", "customername"]);
  const clientIdx = idxOfHeader(headers, ["납품처", "client", "clients"]);
  const farmsIdx = idxOfHeader(headers, ["사용농장", "available_farms", "availablefarms", "farm_ids", "farmids"]);
  const maxIdx = idxOfHeader(headers, ["최대산란일수", "max_laying_days", "maxlayingdays"]);
  const expIdx = idxOfHeader(headers, ["유통기한", "expiration_date", "expirationdate"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const customer_code = parseString(row[codeIdx]);
    const customer_name = parseString(row[nameIdx]);
    const client = parseStringList(row[clientIdx]);
    const available_farms = parseStringList(row[farmsIdx]);
    const maxReq = parseNumberRequired(row[maxIdx]);
    const expReq = parseNumberRequired(row[expIdx]);

    const errs = [];
    if (!customer_code) errs.push("customer_code required");
    if (!customer_name) errs.push("customer_name required");
    if (!maxReq.ok) errs.push("max_laying_days required numeric");
    if (!expReq.ok) errs.push("expiration_date required numeric");

    const parsed = {
      __rowNum: excelRowNum,
      customer_code,
      customer_name,
      client,
      available_farms,
      max_laying_days: maxReq.value,
      expiration_date: expReq.value,
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
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, FARM_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];

  const farmIdIdx = idxOfHeader(headers, ["농장식별자", "farm_id", "farmid"]);
  const nameIdx = idxOfHeader(headers, ["농장명", "farm_name", "farmname"]);
  const shellIdx = idxOfHeader(headers, ["산란번호", "shell_number", "shellnumber"]);
  const typeIdx = idxOfHeader(headers, ["농장유형", "farm_type", "farmtype"]);
  const antiIdx = idxOfHeader(headers, ["무항생제", "antibiotic_free", "antibioticfree"]);
  const haccpIdx = idxOfHeader(headers, ["HACCP", "haccp"]);
  const orgIdx = idxOfHeader(headers, ["유기농", "organic"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const farm_id = parseString(row[farmIdIdx]);
    const farm_name = parseString(row[nameIdx]);
    const shell_number = parseString(row[shellIdx]);
    const farm_type = normalizeFarmType(parseString(row[typeIdx]));
    const antibiotic_free = antiIdx >= 0 ? parseBool(row[antiIdx]) : undefined;
    const haccp = haccpIdx >= 0 ? parseBool(row[haccpIdx]) : undefined;
    const organic = orgIdx >= 0 ? parseBool(row[orgIdx]) : undefined;

    const errs = [];
    if (!farm_id) errs.push("farm_id required");
    if (!farm_name) errs.push("farm_name required");

    const parsed = {
      __rowNum: excelRowNum,
      farm_id,
      farm_name,
      ...(shell_number ? { shell_number } : {}),
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
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, PRODUCT_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];

  const productNoIdx = idxOfHeader(headers, ["제품식별자", "product_no", "productid", "product_id"]);
  const nameIdx = idxOfHeader(headers, ["제품명", "product_name", "productname"]);
  const customerIdx = idxOfHeader(headers, ["고객사코드", "고객사", "customer_code", "customerid", "customer_id"]);
  const eggCountIdx = idxOfHeader(headers, ["계란수", "egg_count", "eggcount"]);
  const breedIdx = idxOfHeader(headers, ["사육번호목록", "breeding_number", "breedingnumber"]);
  const farmTypeIdx = idxOfHeader(headers, ["농장유형", "farm_type", "farmtype"]);
  const gradeIdx = idxOfHeader(headers, ["계란등급", "egg_grade", "egggrade"]);
  const weightIdx = idxOfHeader(headers, ["중량", "egg_weight", "eggweight"]);
  const processIdx = idxOfHeader(headers, ["계란유형", "process_type", "processtype", "egg_type", "eggtype"]);
  const maxIdx = idxOfHeader(headers, ["최대산란일수", "max_laying_days", "maxlayingdays"]);
  const expIdx = idxOfHeader(headers, ["유통기한", "expiration_date", "expirationdate"]);
  const antiIdx = idxOfHeader(headers, ["무항생제", "antibiotic_free", "antibioticfree"]);
  const haccpIdx = idxOfHeader(headers, ["HACCP", "haccp"]);
  const orgIdx = idxOfHeader(headers, ["유기농", "organic"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const product_no = parseString(row[productNoIdx]);
    const product_name = parseString(row[nameIdx]);
    const customer_code = parseString(row[customerIdx]);
    const eggCountReq = parseNumberRequired(row[eggCountIdx]);
    const breeding_number = parseNumberList(row[breedIdx]);
    const farm_type = normalizeFarmType(parseString(row[farmTypeIdx]));
    const egg_grade = normalizeEggGrade(row[gradeIdx]);
    const egg_weight = parseString(row[weightIdx]);
    const process_type = parseString(row[processIdx]);
    const max_laying_days = parseNumberOrNull(row[maxIdx]);
    const expiration_date = parseNumberOrNull(row[expIdx]);
    const antibiotic_free = antiIdx >= 0 ? parseBool(row[antiIdx]) : undefined;
    const haccp = haccpIdx >= 0 ? parseBool(row[haccpIdx]) : undefined;
    const organic = orgIdx >= 0 ? parseBool(row[orgIdx]) : undefined;

    const errs = [];
    if (!product_no) errs.push("product_no required");
    if (!product_name) errs.push("product_name required");
    if (!customer_code) errs.push("customer_code required");
    if (!eggCountReq.ok) errs.push("egg_count required numeric");
    if (!farm_type) errs.push("farm_type required");
    if (!egg_weight) errs.push("egg_weight required");
    if (!process_type) errs.push("process_type required");

    const parsed = {
      __rowNum: excelRowNum,
      product_no,
      product_name,
      customer_code,
      egg_count: eggCountReq.value,
      breeding_number,
      farm_type,
      egg_grade,
      egg_weight,
      process_type,
      ...(max_laying_days != null ? { max_laying_days } : {}),
      ...(expiration_date != null ? { expiration_date } : {}),
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

export function parseEggLotAOA(aoa) {
  const out = { rows: [], errors: [] };
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, EGGLOT_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];

  const lotNoIdx = idxOfHeader(headers, ["계란재고식별자", "계란식별자", "egglot_no", "egglotid", "egg_lot_id"]);
  const farmIdIdx = idxOfHeader(headers, ["농장", "farm_id", "farmid"]);
  const recvIdx = idxOfHeader(headers, ["입고일", "receiving_date", "receivingdate"]);
  const shellIdx = idxOfHeader(headers, ["산란번호", "shell_number", "shellnumber"]);
  const breedIdx = idxOfHeader(headers, ["사육번호", "breeding_number", "breedingnumber"]);
  const farmTypeIdx = idxOfHeader(headers, ["농장유형", "farm_type", "farmtype"]);
  const ageIdx = idxOfHeader(headers, ["주령", "age_weeks", "ageweeks"]);
  const weightIdx = idxOfHeader(headers, ["중량", "egg_weight", "eggweight"]);
  const layingIdx = idxOfHeader(headers, ["산란일", "laying_date", "layingdate"]);
  const gradeIdx = idxOfHeader(headers, ["계란등급", "egg_grade", "egggrade"]);
  const locIdx = idxOfHeader(headers, ["위치", "location"]);
  const qtyIdx = idxOfHeader(headers, ["수량", "quantity"]);
  const memoIdx = idxOfHeader(headers, ["메모", "memo"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const Egglot_no = parseString(row[lotNoIdx]);
    const farm_id = parseString(row[farmIdIdx]);
    const receivingReq = parseDateRequired(row[recvIdx]);
    const shell_number = parseString(row[shellIdx]);
    const breeding_number = parseNumberOrNull(row[breedIdx]);
    const farm_type = normalizeFarmType(parseString(row[farmTypeIdx]));
    const ageReq = parseNumberRequired(row[ageIdx]);
    const egg_weight = parseString(row[weightIdx]);
    const layingReq = parseDateRequired(row[layingIdx]);
    const egg_grade = normalizeEggGrade(row[gradeIdx]);
    const location = parseString(row[locIdx]);
    const qtyReq = parseNumberRequired(row[qtyIdx]);
    const memo = parseString(row[memoIdx]);

    const errs = [];
    if (!farm_id) errs.push("farm_id required");
    if (!receivingReq.ok) errs.push("receiving_date required YYYY-MM-DD");
    if (!ageReq.ok) errs.push("age_weeks required numeric");
    if (!egg_weight) errs.push("egg_weight required");
    if (!layingReq.ok) errs.push("laying_date required YYYY-MM-DD");
    if (!qtyReq.ok) errs.push("quantity required numeric");

    const parsed = {
      __rowNum: excelRowNum,
      ...(Egglot_no ? { Egglot_no } : {}),
      farm_id,
      receiving_date: receivingReq.value,
      ...(shell_number ? { shell_number } : {}),
      ...(breeding_number != null ? { breeding_number } : {}),
      ...(farm_type ? { farm_type } : {}),
      age_weeks: ageReq.value,
      egg_weight,
      laying_date: layingReq.value,
      egg_grade,
      ...(location ? { location } : {}),
      quantity: qtyReq.value,
      ...(memo ? { memo } : {}),
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
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, PRODUCTLOT_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];

  const lotNoIdx = idxOfHeader(headers, ["제품재고식별자", "제품로트식별자", "productlot_no", "productlotid", "product_lot_id"]);
  const productIdx = idxOfHeader(headers, ["제품", "제품식별자", "product_id", "productid", "product_no"]);
  const eggLotIdx = idxOfHeader(headers, ["계란식별자", "계란재고식별자", "원란식별자", "egg_lot_id", "egglotid", "egglot_no"]);
  const qtyIdx = idxOfHeader(headers, ["수량", "quantity"]);
  const locIdx = idxOfHeader(headers, ["위치", "location"]);
  const processDayIdx = idxOfHeader(headers, ["공정일", "process_day", "processday"]);
  const machineIdx = idxOfHeader(headers, ["라인", "machine_line", "machineline"]);
  const memoIdx = idxOfHeader(headers, ["메모", "memo"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const ProductLot_no = parseString(row[lotNoIdx]);
    const product_id = parseString(row[productIdx]);
    const egg_lot_id = parseString(row[eggLotIdx]);
    const qtyReq = parseNumberRequired(row[qtyIdx]);
    const location = parseString(row[locIdx]);
    const process_day = normalizeYMD(row[processDayIdx]);
    const machine_line = parseString(row[machineIdx]);
    const memo = parseString(row[memoIdx]);

    const errs = [];
    if (!product_id) errs.push("product_id required");
    if (!egg_lot_id) errs.push("egg_lot_id required");
    if (!qtyReq.ok) errs.push("quantity required numeric");
    if (!location) errs.push("location required");

    const parsed = {
      __rowNum: excelRowNum,
      ...(ProductLot_no ? { ProductLot_no } : {}),
      product_id,
      egg_lot_id,
      quantity: qtyReq.value,
      location,
      ...(process_day ? { process_day } : {}),
      ...(machine_line ? { machine_line } : {}),
      ...(memo ? { memo } : {}),
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
  if (!Array.isArray(aoa) || !aoa.length) return out;

  const headerRowIdx = findHeaderRow(aoa, HISTORY_MEMO_HEADER_ALIASES);
  const headers = aoa[headerRowIdx] || [];
  const idIdx = idxOfHeader(headers, ["id", "ID", "계란 변경내역ID", "제품 변경내역ID", "변경내역ID"]);
  const memoIdx = idxOfHeader(headers, ["memo", "메모", "변경내역 메모"]);

  for (let r = headerRowIdx + 1; r < aoa.length; r += 1) {
    const row = aoa[r] || [];
    if (isEmptyRow(row)) continue;

    const excelRowNum = r + 1;
    const idReq = parseNumberRequired(row[idIdx]);
    const memo = parseString(row[memoIdx]);

    const errs = [];
    if (!idReq.ok) errs.push("id required numeric");
    if (!memo) errs.push("memo required");

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
