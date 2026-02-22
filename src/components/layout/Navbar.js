import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Layout.css";

export default function Navbar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const username = user?.username || "user";
  const role = user?.role ? String(user.role).toUpperCase() : "";

  return (
    <div className="top-navbar">
      <div className="nav-logo">Haemil ERP</div>

      <div className="nav-menu">
        <NavLink end to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}
        >
          대시보드
        </NavLink>
        <NavLink to="/hr" className={({ isActive }) => (isActive ? "active" : "")}
        >
          인사관리
        </NavLink>
        <NavLink to="/accounting" className={({ isActive }) => (isActive ? "active" : "")}
        >
          정보관리
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => (isActive ? "active" : "")}
        >
          재고관리
        </NavLink>
        <NavLink to="/purchase" className={({ isActive }) => (isActive ? "active" : "")}
        >
          발주관리
        </NavLink>
      </div>

      <div className="nav-right">
        <div className="nav-user">
          <span className="nav-user-label">
            {username}
            {role ? <span className="nav-user-role"> ({role})</span> : null}
          </span>
          <button className="btn secondary small no-hover nav-logout" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
