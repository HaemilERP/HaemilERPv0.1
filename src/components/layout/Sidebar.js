import { useLocation, NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./Layout.css";

export default function Sidebar() {
  const { pathname } = useLocation();
  const [openSet, setOpenSet] = useState(() => new Set());

  const moduleKey = useMemo(() => {
    if (pathname.startsWith("/hr")) return "hr";
    if (pathname.startsWith("/accounting")) return "accounting";
    if (pathname.startsWith("/inventory")) return "inventory";
    return "dashboard";
  }, [pathname]);

  useEffect(() => { setOpenSet(new Set()); }, [moduleKey]);

  const toggleGroup = (group) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const moduleTitle = { dashboard: "대시보드", hr: "인사", accounting: "정보", inventory: "재고" }[moduleKey];

  const itemsByModule = {
    dashboard: [{ group: "main", title: "개요", links: [{ to: "/dashboard", label: "대시보드 홈" }] }],
    hr: [
      { group: "employee", title: "직원관리", links: [{ to: "/hr/employees", label: "직원목록" }, { to: "/hr/edit", label: "직원편집" }, { to: "/hr/add", label: "직원등록" }] },
      { group: "org", title: "조직", links: [{ to: "/hr/departments", label: "부서관리" }] },
    ],
    accounting: [
      { group: "customerinfo", title: "고객사정보", links: [{ to: "/accounting/customer-info", label: "고객사정보" }] },
      { group: "farminfo", title: "농장정보", links: [{ to: "/accounting/farm-info", label: "농장정보" }] },
      { group: "productinfo", title: "제품정보", links: [{ to: "/accounting/product-info", label: "제품정보" }] },
    ],
    inventory: [
      { group: "egg", title: "원란재고", links: [{ to: "/inventory/egg-inventory", label: "Raw Egg Inventory" }] },
      { group: "goods", title: "제품재고", links: [{ to: "/inventory/goods-inventory", label: "Finished Goods Inventory" }] },
      { group: "materials", title: "부자재재고", links: [{ to: "/inventory/materials-inventory", label: "Raw Materials Inventory" }] },
    ],
  };

  const sections = itemsByModule[moduleKey] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">{moduleTitle} 메뉴</div>
      {sections.map((sec) => {
        const isOpen = openSet.has(sec.group);
        return (
          <div className="sidebar-section" key={sec.group}>
            <div className="sidebar-title" onClick={() => toggleGroup(sec.group)}>
              <span>{sec.title}</span>
              <span style={{ opacity: 0.7 }}>{isOpen ? "−" : "+"}</span>
            </div>
            {isOpen && (
              <div className="sidebar-links">
                {sec.links.map((l) => (
                  <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
