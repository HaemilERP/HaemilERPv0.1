import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Layout.css";

const Navbar = () => {
  const { logout } = useAuth();

  return (
    <div className="top-navbar">
      <div className="nav-logo">Haemil ERP</div>

      <div className="nav-menu">
        <NavLink to="/dashboard">대시보드</NavLink>
        <NavLink to="/hr">인사</NavLink>
        <NavLink to="/accounting">회계</NavLink>
        <NavLink to="/inventory">재고</NavLink>
      </div>

      <div className="nav-right">
        <span className="user-pill">Welcome, Admin</span>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Navbar;
