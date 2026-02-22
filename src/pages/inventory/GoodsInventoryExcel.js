import { useMemo, useState } from "react";
import { listProducts } from "../../services/accountingApi";
import {
  createProductLot,
  listEggLots,
  listProductLots,
  patchProductLot,
} from "../../services/inventoryApi";
import {
  downloadProductLotTemplate,
  parseProductLotAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { getApiErrorMessage } from "../../utils/apiError";
import "../accounting/AccountingTable.css";

function pickProductKey(product) {
  return String(product?.product_no || product?.product_id || "").trim();
}

function pickEggLotKey(lot) {
  return String(lot?.Egglot_no || lot?.egg_lot_id || "").trim();
}

export default function GoodsInventoryExcel() {
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
    setParsed(parseProductLotAOA(aoa));
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

    let productMap = {};
    let eggLotMap = {};
    let productLotMap = {};
    try {
      const [products, eggLots, productLots] = await Promise.all([
        listProducts(),
        listEggLots(),
        listProductLots(),
      ]);
      productMap = (products || []).reduce((acc, product) => {
        const key = pickProductKey(product);
        if (key) acc[key] = product;
        return acc;
      }, {});
      eggLotMap = (eggLots || []).reduce((acc, lot) => {
        const key = pickEggLotKey(lot);
        if (key) acc[key] = lot;
        return acc;
      }, {});
      productLotMap = (productLots || []).reduce((acc, lot) => {
        const key = String(lot?.ProductLot_no || "").trim();
        if (key) acc[key] = lot;
        return acc;
      }, {});
    } catch {
      productMap = {};
      eggLotMap = {};
      productLotMap = {};
    }

    for (let i = 0; i < validRows.length; i += 1) {
      const r = validRows[i];
      try {
        const product = productMap[String(r.product_id || "").trim()];
        const eggLot = eggLotMap[String(r.egg_lot_id || "").trim()];

        if (!product?.id) throw new Error(`제품식별자를 찾을 수 없습니다: ${r.product_id}`);
        if (!eggLot?.id) throw new Error(`계란식별자를 찾을 수 없습니다: ${r.egg_lot_id}`);

        const payload = {
          product: Number(product.id),
          egg_lot: Number(eggLot.id),
          quantity: Number(r.quantity),
          location: String(r.location),
          ...(r.process_day ? { process_day: String(r.process_day) } : {}),
          ...(r.machine_line ? { machine_line: String(r.machine_line) } : {}),
          ...(r.memo ? { memo: String(r.memo) } : {}),
        };

        const existing = r.ProductLot_no ? productLotMap[String(r.ProductLot_no).trim()] : null;
        if (existing?.id != null) await patchProductLot(existing.id, payload);
        else await createProductLot(payload);

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
      <h2>제품재고 엑셀 입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        제품재고식별자가 일치할 경우에 수정, 아닐 경우에 일괄로 등록합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-8)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadProductLotTemplate}>
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
                  <th>제품재고식별자</th>
                  <th>제품</th>
                  <th>계란식별자</th>
                  <th>수량</th>
                  <th>위치</th>
                  <th>공정일</th>
                  <th>라인</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.ProductLot_no || "new"}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.ProductLot_no || ""}</td>
                    <td>{r.product_id}</td>
                    <td>{r.egg_lot_id}</td>
                    <td>{r.quantity}</td>
                    <td className="wrap-cell">{r.location}</td>
                    <td>{r.process_day || ""}</td>
                    <td>{r.machine_line || ""}</td>
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
