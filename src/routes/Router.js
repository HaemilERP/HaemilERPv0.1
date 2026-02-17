import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import MainLayout from "../components/layout/MainLayout";
import PageLayout from "../components/layout/PageLayout";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import AdminRoute from "../components/auth/AdminRoute";

import Dashboard from "../pages/Dashboard";
import Employee from "../pages/Employee";
import Accounting from "../pages/Accounting";
import Inventory from "../pages/Inventory";
import Purchase from "../pages/Purchase";

import Employees from "../pages/hr/Employees";
import AddEmployee from "../pages/hr/AddEmployee";
import EditEmployee from "../pages/hr/EditEmployee";

import CustomerInfo from "../pages/accounting/CustomerInfo";
import FarmInfo from "../pages/accounting/FarmInfo";
import ProductInfo from "../pages/accounting/ProductInfo";
import CustomerExcel from "../pages/accounting/CustomerExcel";
import FarmExcel from "../pages/accounting/FarmExcel";
import ProductExcel from "../pages/accounting/ProductExcel";

import EggInventory from "../pages/inventory/EggInventory";
import EggInventoryExcel from "../pages/inventory/EggInventoryExcel";
import EggInventoryHistory from "../pages/inventory/EggInventoryHistory";
import GoodsInventory from "../pages/inventory/GoodsInventory";
import GoodsInventoryExcel from "../pages/inventory/GoodsInventoryExcel";
import GoodsInventoryHistory from "../pages/inventory/GoodsInventoryHistory";
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
            <Route path="/hr/employees" element={<AdminRoute message="직원 목록은 관리자만 조회 가능합니다."><Employees /></AdminRoute>} />
            <Route path="/hr/add" element={<AdminRoute message="직원 등록은 관리자만 가능합니다."><AddEmployee /></AdminRoute>} />
            <Route path="/hr/edit" element={<EditEmployee />} />
            <Route path="/hr/edit/:id" element={<EditEmployee />} />

            <Route path="/accounting" element={<Accounting />} />
            <Route path="/accounting/customer-info" element={<CustomerInfo />} />
            <Route path="/accounting/customer-info/excel" element={<CustomerExcel />} />
            <Route path="/accounting/farm-info" element={<FarmInfo />} />
            <Route path="/accounting/farm-info/excel" element={<FarmExcel />} />
            <Route path="/accounting/product-info" element={<ProductInfo />} />
            <Route path="/accounting/product-info/excel" element={<ProductExcel />} />

            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/egg-inventory" element={<EggInventory />} />
            <Route path="/inventory/egg-inventory/excel" element={<EggInventoryExcel />} />
            <Route path="/inventory/egg-inventory/history" element={<EggInventoryHistory />} />
            <Route path="/inventory/goods-inventory" element={<GoodsInventory />} />
            <Route path="/inventory/goods-inventory/excel" element={<GoodsInventoryExcel />} />
            <Route path="/inventory/goods-inventory/history" element={<GoodsInventoryHistory />} />
            <Route path="/inventory/materials-inventory" element={<MaterialsInventory />} />

            <Route path="/purchase" element={<Purchase />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
