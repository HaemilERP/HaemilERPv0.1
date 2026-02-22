import { useMemo, useState } from "react";
import {
  createProduct,
  listCustomers,
  listProducts,
  patchProduct,
} from "../../services/accountingApi";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  downloadProductTemplate,
  parseProductAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { normalizeFarmType } from "../../utils/helpers";
import "./AccountingTable.css";

function normalizeEggGrade(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "무") return "무";
  if (v === "1") return "1";
  if (v === "1+") return "1+";
  if (v === "기타") return "기타";
  return "기타";
}

export default function ProductExcel() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState({ rows: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  const validRows = useMemo(() => (parsed.rows || []).filter((r) => !r.__invalid), [parsed.rows]);
  const invalidRows = useMemo(() => (parsed.rows || []).filter((r) => r.__invalid), [parsed.rows]);

  async function onPickFile(f) {
    setFile(f || null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    if (!f) {
      setParsed({ rows: [], errors: [] });
      return;
    }
    const aoa = await readFirstSheetAOA(f);
    setParsed(parseProductAOA(aoa));
  }

  async function onUpload() {
    if (loading) return;
    if (!validRows.length) {
      window.alert("업로드할 유효 데이터가 없습니다.");
      return;
    }

    const ok = window.confirm(`총 ${validRows.length}건을 업로드할까요? (오류 ${invalidRows.length}건)`);
    if (!ok) return;

    setLoading(true);
    setResult(null);
    setProgress({ done: 0, total: validRows.length });

    const details = [];
    let success = 0;
    let fail = 0;

    let customerMap = {};
    let productMap = {};
    try {
      const [customers, products] = await Promise.all([listCustomers(), listProducts()]);
      customerMap = (customers || []).reduce((acc, customer) => {
        const key = String(customer?.customer_code || "").trim();
        if (key) acc[key] = customer;
        return acc;
      }, {});
      productMap = (products || []).reduce((acc, product) => {
        const key = String(product?.product_no || "").trim();
        if (key) acc[key] = product;
        return acc;
      }, {});
    } catch {
      customerMap = {};
      productMap = {};
    }

    for (let i = 0; i < validRows.length; i += 1) {
      const r = validRows[i];
      try {
        const customer = customerMap[String(r.customer_code || "").trim()];
        if (!customer?.id) {
          throw new Error(`고객사코드를 찾을 수 없습니다: ${r.customer_code}`);
        }

        const payload = {
          product_no: String(r.product_no),
          product_name: r.product_name,
          customer: Number(customer.id),
          egg_count: Number(r.egg_count),
          breeding_number: Array.isArray(r.breeding_number) ? r.breeding_number : [],
          farm_type: normalizeFarmType(r.farm_type),
          egg_grade: normalizeEggGrade(r.egg_grade),
          egg_weight: String(r.egg_weight),
          process_type: String(r.process_type),
          ...(r.max_laying_days != null ? { max_laying_days: Number(r.max_laying_days) } : {}),
          ...(r.expiration_date != null ? { expiration_date: Number(r.expiration_date) } : {}),
          ...(r.antibiotic_free !== undefined ? { antibiotic_free: Boolean(r.antibiotic_free) } : {}),
          ...(r.haccp !== undefined ? { haccp: Boolean(r.haccp) } : {}),
          ...(r.organic !== undefined ? { organic: Boolean(r.organic) } : {}),
        };

        const existing = productMap[payload.product_no];
        if (existing?.id != null) await patchProduct(existing.id, payload);
        else await createProduct(payload);

        success += 1;
        details.push({ row: r.__rowNum, ok: true, message: "OK" });
      } catch (e) {
        fail += 1;
        details.push({ row: r.__rowNum, ok: false, message: getApiErrorMessage(e, "업로드 실패") });
      } finally {
        setProgress({ done: i + 1, total: validRows.length });
      }
    }

    setResult({ success, fail, details });
    setLoading(false);
  }

  return (
    <div className="page-card">
      <h2>제품정보 엑셀입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        제품식별자가 일치할 경우에 수정, 아닐 경우에 일괄로 등록합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-8)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadProductTemplate}>
          템플릿 다운로드
        </button>

        <label className="btn" style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-8)" }}>
          파일 선택
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </label>

        <button className="btn" type="button" disabled={loading || !validRows.length} onClick={onUpload}>
          업로드 실행
        </button>

        {file && (
          <span style={{ fontSize: "var(--fs-13)", color: "#475569", alignSelf: "center" }}>
            선택한 파일: <b>{file.name}</b>
          </span>
        )}
      </div>

      <div style={{ marginTop: "var(--sp-14)", color: "#64748b", fontSize: "var(--fs-13)" }}>
        {loading
          ? `업로드 중.. (${progress.done}/${progress.total})`
          : file
          ? `유효 ${validRows.length}건 / 오류 ${invalidRows.length}건`
          : "템플릿을 내려받아 작성 후 업로드하세요."}
      </div>

      {!!invalidRows.length && (
        <div style={{ marginTop: "var(--sp-12)" }}>
          <div style={{ fontWeight: 900, marginBottom: "var(--sp-6)" }}>오류 목록</div>
          <div
            style={{
              maxHeight: "clamp(140px, calc(180 * var(--ui)), 220px)",
              overflow: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "var(--radius-md)",
              padding: "var(--sp-10)",
            }}
          >
            {parsed.errors.map((e) => (
              <div
                key={`${e.row}-${e.message}`}
                style={{ fontSize: "var(--fs-13)", color: "#b91c1c", marginBottom: "clamp(3px, calc(4 * var(--ui)), 6px)" }}
              >
                {e.row}행: {e.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {!!validRows.length && (
        <div style={{ marginTop: "var(--sp-14)" }}>
          <div style={{ fontWeight: 900, marginBottom: "var(--sp-6)" }}>미리보기</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Excel 행</th>
                  <th>제품식별자</th>
                  <th>제품명</th>
                  <th>고객사코드</th>
                  <th>계란수</th>
                  <th>사육번호목록</th>
                  <th>농장유형</th>
                  <th>계란등급</th>
                  <th>중량</th>
                  <th>계란유형</th>
                  <th>최대산란일수</th>
                  <th>유통기한</th>
                  <th>무항생제</th>
                  <th>HACCP</th>
                  <th>유기농</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.product_no}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.product_no}</td>
                    <td className="wrap-cell">{r.product_name}</td>
                    <td>{r.customer_code}</td>
                    <td>{r.egg_count}</td>
                    <td>{Array.isArray(r.breeding_number) ? r.breeding_number.join(", ") : ""}</td>
                    <td>{normalizeFarmType(r?.farm_type)}</td>
                    <td>{r.egg_grade}</td>
                    <td>{r.egg_weight}</td>
                    <td>{r.process_type}</td>
                    <td>{r.max_laying_days ?? ""}</td>
                    <td>{r.expiration_date ?? ""}</td>
                    <td>{r.antibiotic_free == null ? "" : r.antibiotic_free ? "유" : "무"}</td>
                    <td>{r.haccp == null ? "" : r.haccp ? "유" : "무"}</td>
                    <td>{r.organic == null ? "" : r.organic ? "유" : "무"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: "var(--sp-16)" }}>
          <div style={{ fontWeight: 900, marginBottom: "var(--sp-6)" }}>
            결과: 성공 {result.success} / 실패 {result.fail}
          </div>
          <div
            style={{
              maxHeight: "clamp(160px, calc(220 * var(--ui)), 260px)",
              overflow: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "var(--radius-md)",
              padding: "var(--sp-10)",
            }}
          >
            {result.details.map((d, idx) => (
              <div
                key={`${d.row}-${idx}`}
                style={{
                  fontSize: "var(--fs-13)",
                  color: d.ok ? "#047857" : "#b91c1c",
                  marginBottom: "clamp(3px, calc(4 * var(--ui)), 6px)",
                }}
              >
                {d.row}행: {d.ok ? "OK" : d.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
