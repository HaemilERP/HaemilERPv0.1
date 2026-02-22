import React from "react";

/**
 * 디자인/클래스는 기존 AccountingTable.css 기준으로 유지
 */
export default function SearchBar({
  field,
  setField,
  text,
  setText,
  fields, // [{value,label}]
  loading,
  onSearch,
  placeholder = "검색어",
  inputWidth = 320,
}) {
  return (
    <div className="searchbar">
      <select className="filter-select" value={field} onChange={(e) => setField(e.target.value)}>
        {fields.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <input
        className="filter-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        style={{ width: inputWidth }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearch();
        }}
      />

      {/* 검색 버튼은 기존(작은) 사이즈로 유지 */}
      <button className="btn small" type="button" disabled={loading} onClick={onSearch}>
        검색
      </button>
    </div>
  );
}
