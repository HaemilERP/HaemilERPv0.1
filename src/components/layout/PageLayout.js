import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "./Layout.css";

const PageLayout = () => {
  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content">
        <Outlet />
      </div>
    </div>
  );
};

export default PageLayout;
