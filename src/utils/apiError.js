import { parseDRFErrors } from "./drfErrors";

/**
 * Axios 에러에서 "서버가 내려준 메시지"만 뽑아옵니다.
 * - err.message ("Request failed with status code 400") 같은 Axios 기본 문구는 사용하지 않습니다.
 * - DRF 형태(detail, non_field_errors, field arrays)도 지원합니다.
 */
export function getApiErrorMessage(err, fallback = "요청에 실패했습니다.") {
  const data = err?.response?.data;

  if (!data) return fallback;

  // DRF 표준/검증 에러 처리
  const parsed = parseDRFErrors(data);
  if (parsed?.form) return parsed.form;

  // ✅ 필드 에러만 내려오는 경우(예: {username: ["..."], password: ["..."]})
  if (parsed?.fields && Object.keys(parsed.fields).length > 0) {
    // 키를 굳이 노출하고 싶지 않으면 values만 합치면 됨
    return Object.values(parsed.fields).filter(Boolean).join("\n");
  }

  // 비표준 키들 방어
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.detail === "string" && data.detail) return data.detail;
  if (typeof data?.error === "string" && data.error) return data.error;
  if (typeof data?.errors === "string" && data.errors) return data.errors;

  // 문자열/배열 등
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.filter(Boolean).join("\n");

  // 마지막 방어: object면 사람이 읽을 수 있게 최대한 합치기
  if (typeof data === "object") {
    const flat = [];
    Object.values(data).forEach((v) => {
      if (!v) return;
      if (typeof v === "string") flat.push(v);
      else if (Array.isArray(v)) flat.push(v.filter(Boolean).join("\n"));
    });
    if (flat.length) return flat.join("\n");
  }

  return fallback;
}

/**
 * DRF validation error에서 필드별 메시지를 뽑아옵니다.
 */
export function getApiFieldErrors(err) {
  const data = err?.response?.data;
  const parsed = parseDRFErrors(data);
  return parsed?.fields || {};
}
