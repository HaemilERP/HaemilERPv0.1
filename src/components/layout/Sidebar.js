import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./Layout.css";

const MODULE_TITLES = {
  dashboard: "대시보드",
  hr: "인사관리",
  accounting: "정보관리",
  inventory: "재고관리",
  purchase: "발주관리",
};

const ITEMS_BY_MODULE = {
  dashboard: [
    {
      group: "main",
      title: "개요",
      links: [{ to: "/dashboard", label: "대시보드" }],
    },
  ],
  hr: [
    {
      group: "employee",
      title: "직원관리",
      links: [
        { to: "/hr/employees", label: "직원목록" },
        { to: "/hr/add", label: "직원등록" },
      ],
    },
  ],
  accounting: [
    {
      group: "customer-info",
      title: "고객사정보",
      links: [
        { to: "/accounting/customer-info", label: "고객사정보" },
        { to: "/accounting/customer-info/excel", label: "엑셀입력" },
      ],
    },
    {
      group: "farm-info",
      title: "농장정보",
      links: [
        { to: "/accounting/farm-info", label: "농장정보" },
        { to: "/accounting/farm-info/excel", label: "엑셀입력" },
      ],
    },
    {
      group: "product-info",
      title: "제품정보",
      links: [
        { to: "/accounting/product-info", label: "제품정보" },
        { to: "/accounting/product-info/excel", label: "엑셀입력" },
      ],
    },
  ],
  inventory: [
    {
      group: "egg",
      title: "계란재고",
      links: [
        { to: "/inventory/egg-inventory", label: "계란재고" },
        { to: "/inventory/egg-inventory/history", label: "변경내역" },
        { to: "/inventory/egg-inventory/excel", label: "엑셀입력" },
      ],
    },
    {
      group: "goods",
      title: "제품재고",
      links: [
        { to: "/inventory/goods-inventory", label: "제품재고" },
        { to: "/inventory/goods-inventory/history", label: "변경내역" },
        { to: "/inventory/goods-inventory/excel", label: "엑셀입력" },
      ],
    },
    {
      group: "materials",
      title: "부자재재고",
      links: [{ to: "/inventory/materials-inventory", label: "Raw Materials Inventory" }],
    },
  ],
  purchase: [
    {
      group: "purchase",
      title: "발주",
      links: [
        { to: "/purchase", label: "발주" },
        { to: "/purchase/quantity-confirmation", label: "생산수량확정" },
        { to: "/purchase/egg-matching", label: "원란매칭" },
        { to: "/purchase/work-orders", label: "작업지시서" },
      ],
    },
  ],
};

const shouldEndMatch = (links, currentTo) =>
  links.some((other) => other.to !== currentTo && other.to.startsWith(currentTo + "/"));

export default function Sidebar() {
  const { pathname } = useLocation();
  const [openSet, setOpenSet] = useState(() => new Set());

  const moduleKey = useMemo(() => {
    if (pathname.startsWith("/hr")) return "hr";
    if (pathname.startsWith("/accounting")) return "accounting";
    if (pathname.startsWith("/inventory")) return "inventory";
    if (pathname.startsWith("/purchase")) return "purchase";
    return "dashboard";
  }, [pathname]);

  useEffect(() => {
    setOpenSet(new Set());
  }, [moduleKey]);

  const toggleGroup = (group) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const moduleTitle = MODULE_TITLES[moduleKey] || "";
  const sections = ITEMS_BY_MODULE[moduleKey] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">{moduleTitle}</div>

      {sections.map((sec) => {
        const isOpen = openSet.has(sec.group);
        return (
          <div key={sec.group} className={`sidebar-section ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              className="sidebar-title"
              onClick={() => toggleGroup(sec.group)}
              aria-expanded={isOpen}
            >
              <span>{sec.title}</span>
              <span className={`sidebar-caret ${isOpen ? "open" : ""}`}>▸</span>
            </button>

            {isOpen && (
              <div className="sidebar-links">
                {sec.links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) => (isActive ? "active" : "")}
                    end={shouldEndMatch(sec.links, l.to)}
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
