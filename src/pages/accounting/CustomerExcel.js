import { useMemo, useState } from "react";
import {
  createCustomer,
  listCustomers,
  listFarms,
  patchCustomer,
} from "../../services/accountingApi";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  downloadCustomerTemplate,
  parseCustomerAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import "./AccountingTable.css";

export default function CustomerExcel() {
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
    setParsed(parseCustomerAOA(aoa));
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
    let farmMap = {};
    try {
      const [customers, farms] = await Promise.all([listCustomers(), listFarms()]);
      customerMap = (customers || []).reduce((acc, customer) => {
        const key = String(customer?.customer_code || "").trim();
        if (key) acc[key] = customer;
        return acc;
      }, {});
      farmMap = (farms || []).reduce((acc, farm) => {
        const key = String(farm?.farm_id || "").trim();
        if (key) acc[key] = farm;
        return acc;
      }, {});
    } catch {
      customerMap = {};
      farmMap = {};
    }

    for (let i = 0; i < validRows.length; i += 1) {
      const r = validRows[i];
      try {
        const farmIds = (r.available_farms || [])
          .map((farmIdentifier) => {
            const found = farmMap[String(farmIdentifier).trim()];
            return found?.id;
          })
          .filter((v) => v != null);

        const payload = {
          customer_code: String(r.customer_code),
          customer_name: r.customer_name,
          client: Array.isArray(r.client) ? r.client : [],
          available_farms: farmIds,
          max_laying_days: Number(r.max_laying_days),
          expiration_date: Number(r.expiration_date),
        };

        const existing = customerMap[payload.customer_code];
        if (existing?.id != null) await patchCustomer(existing.id, payload);
        else await createCustomer(payload);

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
      <h2>고객사정보 엑셀입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        고객사코드가 일치할 경우에 수정, 아닐 경우에 일괄로 등록합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-8)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadCustomerTemplate}>
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
                  <th>고객사코드</th>
                  <th>고객사명</th>
                  <th>납품처</th>
                  <th>사용농장</th>
                  <th>최대산란일수</th>
                  <th>유통기한</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.customer_code}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.customer_code}</td>
                    <td className="wrap-cell">{r.customer_name}</td>
                    <td className="wrap-cell">{(r.client || []).join(", ")}</td>
                    <td className="wrap-cell">{(r.available_farms || []).join(", ")}</td>
                    <td>{r.max_laying_days}</td>
                    <td>{r.expiration_date}</td>
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
