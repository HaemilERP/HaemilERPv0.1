// DRF(Django REST Framework) error response parser
// Returns: { form: string, fields: Record<string, string> }
export function parseDRFErrors(data) {
  const out = { form: "", fields: {} };

  if (!data) return out;

  // If backend returns a plain string
  if (typeof data === "string") {
    out.form = data;
    return out;
  }

  // If backend returns a list of strings
  if (Array.isArray(data)) {
    out.form = data.filter(Boolean).join("\n");
    return out;
  }

  // Object shape
  if (typeof data === "object") {
    // common DRF keys
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
      if (k === "detail" || k === "non_field_errors" || k === "nonFieldErrors" || k === "nonField" ) return;
      const msg = toMsg(v);
      if (msg) out.fields[k] = msg;
    });

    return out;
  }

  out.form = String(data);
  return out;
}
