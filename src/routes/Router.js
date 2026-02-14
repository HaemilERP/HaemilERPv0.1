import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import MainLayout from "../components/layout/MainLayout";
import PageLayout from "../components/layout/PageLayout";
import ProtectedRoute from "../components/auth/ProtectedRoute";

import Dashboard from "../pages/Dashboard";
import Employee from "../pages/Employee";
import Accounting from "../pages/Accounting";
import Inventory from "../pages/Inventory";

import Employees from "../pages/hr/Employees";
import AddEmployee from "../pages/hr/AddEmployee";
import EditEmployee from "../pages/hr/EditEmployee";
import Departments from "../pages/hr/Departments";

import CustomerInfo from "../pages/accounting/CustomerInfo";
import FarmInfo from "../pages/accounting/FarmInfo";
import ProductInfo from "../pages/accounting/ProductInfo";

import EggInventory from "../pages/inventory/EggInventory";
import GoodsInventory from "../pages/inventory/GoodsInventory";
import MaterialsInventory from "../pages/inventory/MaterialsInventory";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Login />} />
          <Route element={<ProtectedRoute><PageLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/hr" element={<Employee />} />
            <Route path="/hr/employees" element={<Employees />} />
            <Route path="/hr/add" element={<AddEmployee />} />
            <Route path="/hr/edit" element={<EditEmployee />} />
            <Route path="/hr/departments" element={<Departments />} />

            <Route path="/accounting" element={<Accounting />} />
            <Route path="/accounting/customer-info" element={<CustomerInfo />} />
            <Route path="/accounting/farm-info" element={<FarmInfo />} />
            <Route path="/accounting/product-info" element={<ProductInfo />} />

            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/egg-inventory" element={<EggInventory />} />
            <Route path="/inventory/goods-inventory" element={<GoodsInventory />} />
            <Route path="/inventory/materials-inventory" element={<MaterialsInventory />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
