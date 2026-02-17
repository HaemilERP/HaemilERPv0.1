import "./Pagination.css";

/**
 * 공통 페이지네이션
 * - 데이터가 적으면 1페이지만 가운데에 표시
 * - 페이지가 많아지면 ... 로 줄여서 표시
 */
export default function Pagination({ page, pageCount, onChange }) {
  const safePageCount = Math.max(1, Number(pageCount) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safePageCount);

  const go = (p) => {
    const next = Math.min(Math.max(1, p), safePageCount);
    if (next !== safePage) onChange(next);
  };

  const pages = buildPages(safePage, safePageCount);

  return (
    <div className="pagination-wrap">
      <button
        type="button"
        className="page-btn nav"
        onClick={() => go(safePage - 1)}
        disabled={safePage <= 1}
        aria-label="이전 페이지"
      >
        ‹
      </button>

      <div className="page-list" role="navigation" aria-label="페이지 이동">
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`page-btn ${p === safePage ? "active" : ""}`}
              onClick={() => go(p)}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        className="page-btn nav"
        onClick={() => go(safePage + 1)}
        disabled={safePage >= safePageCount}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </div>
  );
}

function buildPages(page, total) {
  // 1~7 페이지는 그대로 노출
  if (total <= 7) return range(1, total);

  // 항상 1, 마지막 페이지를 보여주고,
  // 현재 페이지 주변을 2칸씩 보여줌
  const windowSize = 2;
  const start = Math.max(2, page - windowSize);
  const end = Math.min(total - 1, page + windowSize);

  const result = [1];

  if (start > 2) result.push("ellipsis");
  for (let p = start; p <= end; p += 1) result.push(p);
  if (end < total - 1) result.push("ellipsis");

  result.push(total);
  return result;
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i += 1) out.push(i);
  return out;
}
