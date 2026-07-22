import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import UploadTender from '@/pages/UploadTender';
import Analysis from '@/pages/Analysis';
import BOQEditor from '@/pages/BOQEditor';
import PurchaseOrder from '@/pages/PurchaseOrder';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadTender />} />
          <Route path="/analysis/:tenderId" element={<Analysis />} />
          <Route path="/analysis" element={<Navigate to="/" replace />} />
          <Route path="/boq/:tenderId" element={<BOQEditor />} />
          <Route path="/boq" element={<Navigate to="/" replace />} />
          <Route path="/purchase-order/:tenderId" element={<PurchaseOrder />} />
          <Route path="/purchase-order" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
