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

import Ledger from "../pages/accounting/Ledger";
import FinanceReport from "../pages/accounting/Report";
import Tax from "../pages/accounting/Tax";

import StockList from "../pages/inventory/StockList";
import Inbound from "../pages/inventory/Inbound";
import Outbound from "../pages/inventory/Outbound";

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
            <Route path="/accounting/ledger" element={<Ledger />} />
            <Route path="/accounting/report" element={<FinanceReport />} />
            <Route path="/accounting/tax" element={<Tax />} />

            {/* Inventory module */}
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/list" element={<StockList />} />
            <Route path="/inventory/inbound" element={<Inbound />} />
            <Route path="/inventory/outbound" element={<Outbound />} />

            {/* default */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
