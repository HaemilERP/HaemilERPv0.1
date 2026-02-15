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

export function farmsToText(farms) {
  if (!farms) return "";
  if (Array.isArray(farms)) {
    return farms
      .map((f) => (typeof f === "object" ? f.farm_name ?? f.name ?? f.id : f))
      .filter(Boolean)
      .join(", ");
  }
  return asText(farms);
}
