import { useMemo, useState } from "react";
import {
  downloadProductLotHistoryMemoTemplate,
  parseHistoryMemoAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { patchProductLotHistory } from "../../services/inventoryApi";

export default function GoodsInventoryHistoryExcel() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState({ rows: [], errors: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const preview = useMemo(() => parsed.rows.slice(0, 20), [parsed.rows]);

  async function onPick(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
    setParsed({ rows: [], errors: [] });
    setMsg("");
    if (!f) return;

    try {
      const aoa = await readFirstSheetAOA(f);
      setParsed(parseHistoryMemoAOA(aoa));
    } catch (err) {
      setMsg(err?.message || "엑셀 파일을 읽지 못했습니다.");
    }
  }

  async function onUpload() {
    if (busy) return;
    if (!parsed.rows.length) {
      setMsg("업로드할 데이터가 없습니다.");
      return;
    }

    const valid = parsed.rows.filter((r) => !r.__invalid);
    if (!valid.length) {
      setMsg("유효한 행이 없습니다. 오류를 먼저 수정해주세요.");
      return;
    }

    setBusy(true);
    setMsg("");

    let okCount = 0;
    let failCount = 0;

    for (const r of valid) {
      try {
        await patchProductLotHistory(r.id, { memo: r.memo });
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }

    setBusy(false);
    setMsg(`업로드 완료: 성공 ${okCount}건 / 실패 ${failCount}건`);
  }

  return (
    <div className="page-card">
      <h2>제품재고 변경내역 엑셀입력</h2>
      <p style={{ color: "#64748b" }}>
        변경내역은 자동 생성되므로, 이 화면에서는 <b>메모(코멘트)</b>만 일괄 수정합니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-10)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadProductLotHistoryMemoTemplate}>
          템플릿 다운로드
        </button>

        <label className="btn" style={{ cursor: busy ? "not-allowed" : "pointer" }}>
          파일 선택
          <input type="file" accept=".xlsx" onChange={onPick} disabled={busy} style={{ display: "none" }} />
        </label>

        <button className="btn" type="button" onClick={onUpload} disabled={busy}>
          {busy ? "업로드 중..." : "업로드"}
        </button>
      </div>

      {file && (
        <div className="muted" style={{ marginTop: "var(--sp-10)" }}>
          선택된 파일: {file.name}
        </div>
      )}

      {msg && (
        <div className="field-error" style={{ marginTop: "var(--sp-10)", whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      )}

      {parsed.errors?.length > 0 && (
        <div style={{ marginTop: "var(--sp-14)" }}>
          <div className="filters-title">오류</div>
          <div className="muted">상위 {Math.min(parsed.errors.length, 50)}건만 표시됩니다.</div>
          <div className="table-wrap" style={{ marginTop: "var(--sp-10)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>행</th>
                  <th>메시지</th>
                </tr>
              </thead>
              <tbody>
                {parsed.errors.slice(0, 50).map((e, idx) => (
                  <tr key={idx}>
                    <td>{e.row}</td>
                    <td className="wrap-cell">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div style={{ marginTop: "var(--sp-14)" }}>
          <div className="filters-title">미리보기</div>
          <div className="muted">상위 20건만 표시됩니다.</div>

          <div className="table-wrap" style={{ marginTop: "var(--sp-10)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>ID</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.id}</td>
                    <td className="wrap-cell">{r.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
