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

  return (
    <div className="top-navbar">
      <div className="nav-logo">Haemil ERP</div>

      <div className="nav-menu">
        <NavLink to="/dashboard">대시보드</NavLink>
        <NavLink to="/hr">인사</NavLink>
        <NavLink to="/accounting">정보</NavLink>
        <NavLink to="/inventory">재고</NavLink>
        <NavLink to="/purchase">발주</NavLink>
      </div>

      <div className="nav-right">
        <span className="user-pill">
          {user?.username || "user"} {user?.role ? `(${user.role})` : ""}
        </span>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
