import "./Pagination.css";
import { useEffect, useState } from "react";

export default function Pagination({
  page,
  pageCount,
  onChange,
  // backward compatible props (일부 페이지에서 사용)
  totalPages,
  setPage,
}) {
  const onPageChange = onChange ?? setPage;
  const safePageCount = Math.max(1, Number(pageCount ?? totalPages) || 1);
  const safePage = clamp(Number(page) || 1, 1, safePageCount);

  // page jump input (controlled)
  const [jumpValue, setJumpValue] = useState(String(safePage));
  useEffect(() => setJumpValue(String(safePage)), [safePage]);

  const go = (p) => {
    const next = clamp(p, 1, safePageCount);
    if (next !== safePage && typeof onPageChange === "function") onPageChange(next);
  };

  const pages = buildPages(safePage, safePageCount);

  const restoreJumpToCurrent = () => setJumpValue(String(safePage));

  const submitJump = (e) => {
    e.preventDefault();
    const next = Number.parseInt(jumpValue, 10);
    // 범위 밖/유효하지 않은 값이면 "이동 없음" + 현재 페이지로 복구
    if (!Number.isFinite(next) || next < 1 || next > safePageCount) {
      restoreJumpToCurrent();
      return;
    }
    if (next !== safePage && typeof onPageChange === "function") onPageChange(next);
  };

  return (
    <div className="pagination-wrap">
      {/* center: 기존 페이지네이션(버튼 클릭 이동) */}
      <div className="pagination-center">
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

      {/* right: 페이지 점프 (페이지가 1개면 숨김) */}
      {safePageCount > 1 && (
        <form className="pagination-jump" onSubmit={submitJump} noValidate>
          <label className="page-jump-label" aria-label="페이지 점프">
            <input
              className="page-jump-input"
              type="number"
              inputMode="numeric"
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onBlur={() => {
                const next = Number.parseInt(jumpValue, 10);
                if (!Number.isFinite(next) || next < 1 || next > safePageCount) {
                  restoreJumpToCurrent();
                }
              }}
              aria-label="이동할 페이지"
            />
          </label>
          <span className="page-jump-total">/{safePageCount}</span>
          <button type="submit" className="page-jump-btn">
            이동
          </button>
        </form>
      )}
    </div>
  );
}

function clamp(n, min, max) {
  return Math.min(Math.max(min, n), max);
}

function buildPages(page, total) {
  // 보여지는 페이지(숫자 버튼)는 최대 5개로 고정
  // - 초반(1~3): 1,2,3,4, …, 마지막
  // - 중간: 1, …, 현재-1, 현재, 현재+1, …, 마지막
  // - 후반(마지막-2~마지막): 1, …, 마지막-3, 마지막-2, 마지막-1, 마지막
  if (total <= 5) return range(1, total);

  // 1, 2, 3 페이지에서는 앞쪽 4개 + 마지막
  if (page <= 3) {
    return [1, 2, 3, 4, "ellipsis", total];
  }

  // 마지막, 마지막-1, 마지막-2 페이지에서는 1 + 마지막쪽 4개
  if (page >= total - 2) {
    return [1, "ellipsis", total - 3, total - 2, total - 1, total];
  }

  // 그 외(중간)
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", total];
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i += 1) out.push(i);
  return out;
}
