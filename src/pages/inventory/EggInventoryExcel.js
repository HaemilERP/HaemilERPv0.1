import { useMemo, useState } from "react";
import { listFarms } from "../../services/accountingApi";
import { createEggLot, listEggLots, patchEggLot } from "../../services/inventoryApi";
import {
  downloadEggLotTemplate,
  parseEggLotAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { getApiErrorMessage } from "../../utils/apiError";
import { normalizeFarmType } from "../../utils/helpers";
import "../accounting/AccountingTable.css";

function normalizeEggGrade(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "무") return "무";
  if (v === "1") return "1";
  if (v === "1+") return "1+";
  if (v === "기타") return "기타";
  return "기타";
}

export default function EggInventoryExcel() {
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
    setParsed(parseEggLotAOA(aoa));
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

    let farmMap = {};
    let lotMap = {};
    try {
      const [farms, lots] = await Promise.all([listFarms(), listEggLots()]);
      farmMap = (farms || []).reduce((acc, farm) => {
        const key = String(farm?.farm_id || "").trim();
        if (key) acc[key] = farm;
        return acc;
      }, {});
      lotMap = (lots || []).reduce((acc, lot) => {
        const key = String(lot?.Egglot_no || "").trim();
        if (key) acc[key] = lot;
        return acc;
      }, {});
    } catch {
      farmMap = {};
      lotMap = {};
    }

    for (let i = 0; i < validRows.length; i += 1) {
      const r = validRows[i];
      try {
        const farm = farmMap[String(r.farm_id || "").trim()];
        if (!farm?.id) {
          throw new Error(`농장식별자를 찾을 수 없습니다: ${r.farm_id}`);
        }

        const payload = {
          farm: Number(farm.id),
          receiving_date: r.receiving_date,
          age_weeks: Number(r.age_weeks),
          farm_type: normalizeFarmType(r.farm_type),
          egg_weight: String(r.egg_weight),
          laying_date: r.laying_date,
          egg_grade: normalizeEggGrade(r.egg_grade),
          quantity: Number(r.quantity),
          ...(r.shell_number ? { shell_number: String(r.shell_number) } : {}),
          ...(r.breeding_number != null ? { breeding_number: Number(r.breeding_number) } : {}),
          ...(r.location ? { location: String(r.location) } : {}),
          ...(r.memo ? { memo: String(r.memo) } : {}),
        };

        const existing = r.Egglot_no ? lotMap[String(r.Egglot_no).trim()] : null;
        if (existing?.id != null) await patchEggLot(existing.id, payload);
        else await createEggLot(payload);

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
      <h2>계란재고 엑셀 입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        계란재고식별자가 일치할 경우에 수정, 아닐 경우에 일괄로 등록합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-8)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadEggLotTemplate}>
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
            선택 파일: <b>{file.name}</b>
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

      {!!parsed.errors?.length && (
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
            {parsed.errors.map((e, idx) => (
              <div
                key={`${e.row}-${idx}`}
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
                  <th>계란재고식별자</th>
                  <th>농장</th>
                  <th>농장유형</th>
                  <th>산란번호</th>
                  <th>입고일</th>
                  <th>산란일</th>
                  <th>중량</th>
                  <th>계란등급</th>
                  <th>위치</th>
                  <th>주령</th>
                  <th>수량</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.Egglot_no || "new"}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.Egglot_no || ""}</td>
                    <td>{r.farm_id}</td>
                    <td>{normalizeFarmType(r?.farm_type)}</td>
                    <td>{r.shell_number || ""}</td>
                    <td>{r.receiving_date}</td>
                    <td>{r.laying_date}</td>
                    <td>{r.egg_weight}</td>
                    <td>{r.egg_grade}</td>
                    <td>{r.location || ""}</td>
                    <td>{r.age_weeks}</td>
                    <td>{r.quantity}</td>
                    <td className="wrap-cell">{r.memo || ""}</td>
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
