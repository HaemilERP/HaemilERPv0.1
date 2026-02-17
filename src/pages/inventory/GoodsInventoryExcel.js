import { useMemo, useState } from "react";
import {
  downloadProductLotTemplate,
  parseProductLotAOA,
  readFirstSheetAOA,
} from "../../utils/excel";
import { createProductLot, patchProductLot } from "../../services/inventoryApi";

export default function GoodsInventoryExcel() {
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
      setParsed(parseProductLotAOA(aoa));
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
        const payload = {
          product: r.product,
          quantity: r.quantity,
          location: r.location,
          egg_lot: r.egg_lot,
          ...(r.memo ? { memo: r.memo } : {}),
          ...(r.is_active !== undefined ? { is_active: r.is_active } : {}),
        };

        if (r.id != null) await patchProductLot(r.id, payload);
        else await createProductLot(payload);

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
      <h2>제품재고 엑셀입력</h2>
      <p style={{ color: "#64748b" }}>
        템플릿을 다운로드한 후 데이터를 입력하고 업로드하세요. ID가 있으면 수정(PATCH), 없으면 신규등록(POST)으로 처리됩니다.
      </p>

      <div style={{ display: "flex", gap: "var(--sp-10)", flexWrap: "wrap", marginTop: "var(--sp-12)" }}>
        <button className="btn secondary" type="button" onClick={downloadProductLotTemplate}>
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
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 120 }}>제품ID</th>
                  <th style={{ width: 110 }}>수량</th>
                  <th style={{ width: 220 }}>위치</th>
                  <th style={{ width: 140 }}>계란재고ID</th>
                  <th>메모</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, idx) => (
                  <tr key={idx}>
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
    </div>
  );
}
