// API list response normalizer
// - supports plain array responses and DRF-style {results:[...]}

export function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.results)) return data.results;
  return [];
}
