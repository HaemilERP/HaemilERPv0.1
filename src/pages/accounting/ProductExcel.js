import { useMemo, useState } from "react";
import { createProduct, patchProduct } from "../../services/accountingApi";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  downloadProductTemplate,
  readFirstSheetAOA,
  parseProductAOA,
} from "../../utils/excel";
import "./AccountingTable.css";

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
    const p = parseProductAOA(aoa);
    setParsed(p);
  }

  async function onUpload() {
    if (loading) return;
    if (!validRows.length) {
      alert("업로드할 유효 데이터가 없습니다.");
      return;
    }

    const ok = window.confirm(`총 ${validRows.length}건을 업로드할까요? (오류 행: ${invalidRows.length}건)`);
    if (!ok) return;

    setLoading(true);
    setResult(null);
    setProgress({ done: 0, total: validRows.length });

    const details = [];
    let success = 0;
    let fail = 0;

    for (let i = 0; i < validRows.length; i += 1) {
      const r = validRows[i];
      try {
        const payload = {
          product_name: r.product_name,
          customer: Number(r.customer),
          egg_count: Number(r.egg_count),
          breeding_number: Number(r.breeding_number),
          farm_type: String(r.farm_type),
          egg_grade: String(r.egg_grade),
          egg_weight: String(r.egg_weight),
          process_type: String(r.process_type),
          ...(r.max_laying_days != null ? { max_laying_days: Number(r.max_laying_days) } : {}),
          ...(r.expiration_date != null ? { expiration_date: Number(r.expiration_date) } : {}),
          antibiotic_free: Boolean(r.antibiotic_free),
          haccp: Boolean(r.haccp),
          organic: Boolean(r.organic),
          ...(r.is_active !== undefined ? { is_active: Boolean(r.is_active) } : {}),
        };

        if (r.id != null) await patchProduct(r.id, payload);
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
        제품정보를 일괄로 등록/수정할 수 있습니다. ID 항목이 일치할 경우에 수정, 아닐 경우에 등록합니다.
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
            선택됨: <b>{file.name}</b>
          </span>
        )}
      </div>

      <div style={{ marginTop: "var(--sp-14)", color: "#64748b", fontSize: "var(--fs-13)" }}>
        {loading
          ? `업로드 중... (${progress.done}/${progress.total})`
          : file
          ? `유효 ${validRows.length}건 / 오류 ${invalidRows.length}건`
          : "템플릿을 내려받아 작성 후 업로드하세요."}
      </div>

      {!!invalidRows.length && (
        <div style={{ marginTop: "var(--sp-12)" }}>
          <div style={{ fontWeight: 900, marginBottom: "var(--sp-6)" }}>오류 행</div>
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
                  <th>id</th>
                  <th>제품명</th>
                  <th>고객사ID</th>
                  <th>계란수</th>
                  <th>사육번호</th>
                  <th>농장유형</th>
                  <th>등급</th>
                  <th>난중</th>
                  <th>가공</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.product_name}`}
                  >
                    <td>{r.__rowNum}</td>
                    <td>{r.id ?? ""}</td>
                    <td className="wrap-cell">{r.product_name}</td>
                    <td>{r.customer}</td>
                    <td>{r.egg_count}</td>
                    <td>{r.breeding_number}</td>
                    <td>{r.farm_type}</td>
                    <td>{r.egg_grade}</td>
                    <td>{r.egg_weight}</td>
                    <td>{r.process_type}</td>
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
