import { useCallback, useMemo, useState } from "react";
import { getApiErrorMessage } from "../utils/apiError";

export default function useExcelBatchUpload({
  parseAOA,
  readAOA,
  uploadRow,
  confirmMessage,
  emptyValidMessage = "업로드할 유효 데이터가 없습니다.",
  uploadFailMessage = "업로드 실패",
  readFailMessage = "엑셀 파일을 읽지 못했습니다.",
}) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState({ rows: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  const validRows = useMemo(() => (parsed.rows || []).filter((r) => !r.__invalid), [parsed.rows]);
  const invalidRows = useMemo(() => (parsed.rows || []).filter((r) => r.__invalid), [parsed.rows]);

  const onPickFile = useCallback(
    async (f) => {
      setFile(f || null);
      setResult(null);
      setProgress({ done: 0, total: 0 });

      if (!f) {
        setParsed({ rows: [], errors: [] });
        return;
      }

      try {
        const aoa = await readAOA(f);
        setParsed(parseAOA(aoa));
      } catch (err) {
        setParsed({
          rows: [],
          errors: [{ row: "-", message: err?.message || readFailMessage }],
        });
      }
    },
    [parseAOA, readAOA, readFailMessage]
  );

  const onUpload = useCallback(async () => {
    if (loading) return;
    if (!validRows.length) {
      alert(emptyValidMessage);
      return;
    }

    const confirmText =
      typeof confirmMessage === "function"
        ? confirmMessage(validRows.length, invalidRows.length)
        : confirmMessage || `총 ${validRows.length}건을 업로드할까요? (오류 행 ${invalidRows.length}건)`;
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setLoading(true);
    setResult(null);
    setProgress({ done: 0, total: validRows.length });

    const details = [];
    let success = 0;
    let fail = 0;

    for (let i = 0; i < validRows.length; i += 1) {
      const row = validRows[i];
      const rowNum = row?.__rowNum ?? i + 1;
      try {
        await uploadRow(row);
        success += 1;
        details.push({ row: rowNum, ok: true, message: "OK" });
      } catch (e) {
        fail += 1;
        details.push({
          row: rowNum,
          ok: false,
          message: getApiErrorMessage(e, uploadFailMessage),
        });
      } finally {
        setProgress({ done: i + 1, total: validRows.length });
      }
    }

    setResult({ success, fail, details });
    setLoading(false);
  }, [
    confirmMessage,
    emptyValidMessage,
    invalidRows.length,
    loading,
    uploadFailMessage,
    uploadRow,
    validRows,
  ]);

  return {
    file,
    parsed,
    loading,
    progress,
    result,
    validRows,
    invalidRows,
    onPickFile,
    onUpload,
  };
}
