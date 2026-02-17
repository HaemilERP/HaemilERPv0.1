import { useCallback } from "react";
import {
  downloadEggLotHistoryMemoTemplate,
  parseHistoryMemoAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { patchEggLotHistory } from "../../services/inventoryApi";
import useExcelBatchUpload from "../../hooks/useExcelBatchUpload";
import "../accounting/AccountingTable.css";

export default function EggInventoryHistoryExcel() {
  const uploadRow = useCallback(async (row) => {
    await patchEggLotHistory(row.id, { memo: row.memo });
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
    parseAOA: parseHistoryMemoAOA,
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
      <h2>계란재고 변경내역 엑셀 입력</h2>
      <p style={{ color: "#64748b", marginTop: "var(--sp-6)" }}>
        변경내역은 자동 생성되며 이 화면에서는 메모만 일괄 수정합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-8)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadEggLotHistoryMemoTemplate}>
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
          <div style={{ fontWeight: 900, marginBottom: "var(--sp-6)" }}>미리보기 (상위 20건)</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Excel 행</th>
                  <th>ID</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 20).map((r) => (
                  <tr key={`${r.__rowNum}-${r.id}`}>
                    <td>{r.__rowNum}</td>
                    <td>{r.id}</td>
                    <td className="wrap-cell">{r.memo}</td>
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
