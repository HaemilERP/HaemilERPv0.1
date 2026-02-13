import { useLocation, NavLink } from "react-router-dom";
import { useMemo, useState } from "react";
import "./Layout.css";

const Sidebar = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState("main");

  const moduleKey = useMemo(() => {
    if (pathname.startsWith("/hr")) return "hr";
    if (pathname.startsWith("/accounting")) return "accounting";
    if (pathname.startsWith("/inventory")) return "inventory";
    return "dashboard";
  }, [pathname]);

  const moduleTitle = {
    dashboard: "대시보드",
    hr: "인사",
    accounting: "회계",
    inventory: "재고",
  }[moduleKey];

  const itemsByModule = {
    dashboard: [
      { group: "main", title: "개요", links: [{ to: "/dashboard", label: "대시보드 홈" }] },
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
      {
        group: "org",
        title: "조직",
        links: [{ to: "/hr/departments", label: "부서관리" }],
      },
    ],
    accounting: [
      {
        group: "finance",
        title: "회계관리",
        links: [
          { to: "/accounting/ledger", label: "원장" },
          { to: "/accounting/report", label: "재무제표" },
        ],
      },
      {
        group: "tax",
        title: "세무",
        links: [{ to: "/accounting/tax", label: "세금관리" }],
      },
    ],
    inventory: [
      {
        group: "stock",
        title: "재고관리",
        links: [
          { to: "/inventory/list", label: "재고목록" },
          { to: "/inventory/inbound", label: "입고관리" },
        ],
      },
      {
        group: "outbound",
        title: "출고",
        links: [{ to: "/inventory/outbound", label: "출고관리" }],
      },
    ],
  };

  const sections = itemsByModule[moduleKey] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">{moduleTitle} 메뉴</div>

      {sections.map((sec) => (
        <div className="sidebar-section" key={sec.group}>
          <div
            className="sidebar-title"
            onClick={() => setOpen(open === sec.group ? "" : sec.group)}
          >
            <span>{sec.title}</span>
            <span style={{ opacity: 0.7 }}>{open === sec.group ? "−" : "+"}</span>
          </div>

          {open === sec.group && (
            <div className="sidebar-links">
              {sec.links.map((l) => (
                <NavLink key={l.to} to={l.to}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
