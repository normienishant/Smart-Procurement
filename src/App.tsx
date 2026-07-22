import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
        {/* Toast container – positioned bottom-right with dark theme */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111111',
              color: '#f5f5f5',
              border: '1px solid #242424',
              borderRadius: '12px',
              padding: '12px 16px',
            },
          }}
        />
      </Layout>
    </BrowserRouter>
  );
}