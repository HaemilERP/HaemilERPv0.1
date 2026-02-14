import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";

export default function MainLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/";
  return (
    <div>
      {!isLogin && <Navbar />}
      <Outlet />
    </div>
  );
}
