import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import MainLayout from "../components/layout/MainLayout";
import PageLayout from "../components/layout/PageLayout";
import ProtectedRoute from "../components/auth/ProtectedRoute";

import Dashboard from "../pages/Dashboard";
import Employee from "../pages/Employee";
import Accounting from "../pages/Accounting";
import Inventory from "../pages/Inventory";

// Sub pages (new)
import HREmployees from "../pages/hr/Employees";
import HRAdd from "../pages/hr/AddEmployee";
import HRDepartments from "../pages/hr/Departments";

import ACustomerInfo from "../pages/accounting/CustomerInfo";
import AFarmInfo from "../pages/accounting/FarmInfo";
import AProductInfo from "../pages/accounting/ProductInfo";

import Egg from "../pages/inventory/EggInventory";
import Goods from "../pages/inventory/GoodsInventory";
import Materials from "../pages/inventory/MaterialsInventory";

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* MainLayout keeps (post-login) navbar fixed */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Login />} />

          {/* Protected ERP 영역 */}
          <Route
            element={
              <ProtectedRoute>
                <PageLayout />
              </ProtectedRoute>
            }
          >
            {/* Top-level pages */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* HR module */}
            <Route path="/hr" element={<Employee />} />
            <Route path="/hr/employees" element={<HREmployees />} />
            <Route path="/hr/add" element={<HRAdd />} />
            <Route path="/hr/departments" element={<HRDepartments />} />

            {/* Accounting module */}
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/accounting/CustomerInfo" element={<ACustomerInfo />} />
            <Route path="/accounting/FarmInfo" element={<AFarmInfo />} />
            <Route path="/accounting/ProductInfo" element={<AProductInfo />} />

            {/* Inventory module */}
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/EggInventory" element={<Egg />} />
            <Route path="/inventory/GoodsInventory" element={<Goods />} />
            <Route path="/inventory/MaterialsInventory" element={<Materials />} />

            {/* default */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
