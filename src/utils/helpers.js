// Consolidated utilities (single entry point)
// Goal: reduce duplicate helper files while keeping existing behavior.

// --- API list response normalizer ---
// Supports plain array responses and DRF-style { results: [...] }
export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.results)) return data.results;
  return [];
}

// --- DRF(Django REST Framework) error response parser ---
// Returns: { form: string, fields: Record<string, string> }
export function parseDRFErrors(data) {
  const out = { form: "", fields: {} };
  if (!data) return out;

  if (typeof data === "string") {
    out.form = data;
    return out;
  }

  if (Array.isArray(data)) {
    out.form = data.filter(Boolean).join("\n");
    return out;
  }

  if (typeof data === "object") {
    const detail = data.detail;
    const nonField = data.non_field_errors || data.nonFieldErrors || data.nonField;

    const toMsg = (v) => {
      if (!v) return "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.filter(Boolean).join("\n");
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };

    const formMsg = [toMsg(detail), toMsg(nonField)].filter(Boolean).join("\n");
    if (formMsg) out.form = formMsg;

    Object.entries(data).forEach(([k, v]) => {
      if (
        k === "detail" ||
        k === "non_field_errors" ||
        k === "nonFieldErrors" ||
        k === "nonField"
      )
        return;
      const msg = toMsg(v);
      if (msg) out.fields[k] = msg;
    });

    return out;
  }

  out.form = String(data);
  return out;
}

// --- Axios error helpers ---
// Extracts the most relevant message from server response (DRF-friendly)
export function getApiErrorMessage(err, fallback = "요청에 실패했습니다.") {
  const data = err?.response?.data;
  if (!data) return fallback;

  const parsed = parseDRFErrors(data);
  if (parsed?.form) return parsed.form;

  // Field-only errors: join values
  if (parsed?.fields && Object.keys(parsed.fields).length > 0) {
    return Object.values(parsed.fields).filter(Boolean).join("\n");
  }

  // Non-standard keys
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.detail === "string" && data.detail) return data.detail;
  if (typeof data?.error === "string" && data.error) return data.error;
  if (typeof data?.errors === "string" && data.errors) return data.errors;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.filter(Boolean).join("\n");

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

// Field-level error map (DRF validation)
export function getApiFieldErrors(err) {
  const data = err?.response?.data;
  const parsed = parseDRFErrors(data);
  return parsed?.fields || {};
}

// --- Table helpers ---
export const BOOL_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "예" },
  { value: "false", label: "아니오" },
];

export function asText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function includesText(hay, needle) {
  return asText(hay).toLowerCase().includes(asText(needle).toLowerCase().trim());
}

export function matchBool(value, filterValue) {
  if (filterValue === "") return true;
  const want = filterValue === "true";
  return Boolean(value) === want;
}

export function includesAllTokens(hay, query) {
  const tokens = asText(query)
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const h = asText(hay).toLowerCase();
  return tokens.every((t) => h.includes(t));
}

// Like includesAllTokens, but matches if ANY token exists (OR)
export function includesAnyTokens(hay, query) {
  const tokens = asText(query)
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const h = asText(hay).toLowerCase();
  return tokens.some((t) => h.includes(t));
}

function formatFarmLabel(farmName, farmId) {
  const name = asText(farmName).trim();
  const id = farmId === null || farmId === undefined ? "" : asText(farmId).trim();
  if (name && id) return `${name}(${id})`;
  return name || id;
}

export function farmsToText(farms, farmsById) {
  if (!farms) return "";
  const byId = farmsById || null;

  const toLabel = (f) => {
    if (f === null || f === undefined) return "";
    // object form: {id, farm_name, ...}
    if (typeof f === "object") {
      const id = f.id ?? f.farm_id ?? f.pk;
      const name = f.farm_name ?? f.name ?? f.title;
      return formatFarmLabel(name, id);
    }

    // primitive id or name
    const id = asText(f).trim();
    if (byId && id && byId[id]) {
      const found = byId[id];
      return formatFarmLabel(found?.farm_name ?? found?.name ?? found?.title, found?.id ?? id);
    }
    return id;
  };

  if (Array.isArray(farms)) {
    return farms.map(toLabel).filter(Boolean).join(", ");
  }
  return toLabel(farms);
}
