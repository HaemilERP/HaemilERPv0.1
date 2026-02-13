import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import "./Layout.css";

const MainLayout = () => {
  const { pathname } = useLocation();
  const showNavbar = pathname !== "/";

  return (
    <div className="main-container">
      {showNavbar && <Navbar />}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
