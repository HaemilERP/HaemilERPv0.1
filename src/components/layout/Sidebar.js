import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./Layout.css";

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
    // 모듈이 바뀌면 아코디언 상태 초기화
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

  const moduleTitle = {
    dashboard: "대시보드",
    hr: "인사",
    accounting: "정보",
    inventory: "재고",
    purchase: "발주",
  }[moduleKey];

  const itemsByModule = {
    dashboard: [
      {
        group: "main",
        title: "개요",
        links: [{ to: "/dashboard", label: "대시보드 홈" }],
      },
    ],
    hr: [
      {
        group: "employee",
        title: "직원관리",
        links: [
          { to: "/hr/employees", label: "직원목록" },
          { to: "/hr/add", label: "직원등록" },
          { to: "/hr/edit", label: "직원편집" },
        ],
      },
    ],
    accounting: [
      {
        group: "customerinfo",
        title: "고객사정보",
        links: [
          { to: "/accounting/customer-info", label: "고객사정보" },
          { to: "/accounting/customer-info/excel", label: "엑셀입력" },
        ],
      },
      {
        group: "farminfo",
        title: "농장정보",
        links: [
          { to: "/accounting/farm-info", label: "농장정보" },
          { to: "/accounting/farm-info/excel", label: "엑셀입력" },
        ],
      },
      {
        group: "productinfo",
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
        links: [{ to: "/purchase", label: "발주" }],
      },
    ],
  };

  const sections = itemsByModule[moduleKey] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">{moduleTitle} 메뉴</div>

      {sections.map((sec) => {
        const isOpen = openSet.has(sec.group);
        return (
          <div key={sec.group} className="sidebar-section">
            <div className="sidebar-title" onClick={() => toggleGroup(sec.group)}>
              <span>{sec.title}</span>
              <span>{isOpen ? "▾" : "▸"}</span>
            </div>

            {isOpen && (
              <div className="sidebar-links">
                {sec.links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    // react-router v6 NavLink 는 기본적으로 prefix match 입니다.
                    // 예: /accounting/customer-info/excel 에서는
                    // /accounting/customer-info 도 active 로 잡혀 2개가 동시에 하이라이트됩니다.
                    // 같은 섹션 내에서 '하위 경로를 가진 링크'는 exact(end) 매칭으로 바꿔
                    // 현재 페이지에 해당하는 메뉴만 하이라이트되도록 합니다.
                    end={sec.links.some(
                      (other) => other.to !== l.to && other.to.startsWith(l.to + "/")
                    )}
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
