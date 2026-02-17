import { useCallback } from "react";
import {
  downloadProductLotTemplate,
  parseProductLotAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { createProductLot, patchProductLot } from "../../services/inventoryApi";
import useExcelBatchUpload from "../../hooks/useExcelBatchUpload";
import "../accounting/AccountingTable.css";

export default function GoodsInventoryExcel() {
  const uploadRow = useCallback(async (row) => {
    const payload = {
      product: row.product,
      quantity: row.quantity,
      location: row.location,
      egg_lot: row.egg_lot,
      ...(row.memo ? { memo: row.memo } : {}),
      ...(row.is_active !== undefined ? { is_active: row.is_active } : {}),
    };

    if (row.id != null) await patchProductLot(row.id, payload);
    else await createProductLot(payload);
  }, []);

  const {
    file,
    parsed,
    loading,
    progress,
    result,
    validRows,
    invalidRows,
    onPickFile,
    onUpload,
  } = useExcelBatchUpload({
    parseAOA: parseProductLotAOA,
    readAOA: readFirstSheetAOA,
    uploadRow,
    confirmMessage: (validCount, invalidCount) =>
      `총 ${validCount}건을 업로드할까요? (오류 행 ${invalidCount}건)`,
    emptyValidMessage: "업로드할 유효 데이터가 없습니다.",
    uploadFailMessage: "업로드 실패",
    readFailMessage: "엑셀 파일을 읽지 못했습니다.",
  });

  return (
    <div className="page-card">
      <h2>제품재고 엑셀 입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        제품재고를 엑셀로 등록/수정할 수 있습니다. ID가 있으면 수정, 없으면 신규 등록됩니다.
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
          ? `업로드 중... (${progress.done}/${progress.total})`
          : file
          ? `유효 ${validRows.length}건 / 오류 ${invalidRows.length}건`
          : "템플릿을 내려받아 작성 후 업로드하세요."}
      </div>

      {!!parsed.errors?.length && (
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
                  <th>ID</th>
                  <th>제품ID</th>
                  <th>수량</th>
                  <th>위치</th>
                  <th>계란재고ID</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {validRows.map((r) => (
                  <tr key={`${r.__rowNum}-${r.id ?? "new"}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.id ?? ""}</td>
                    <td>{r.product}</td>
                    <td>{r.quantity}</td>
                    <td className="wrap-cell">{r.location}</td>
                    <td>{r.egg_lot}</td>
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
