import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScanProvider } from './context/ScanContext';
import { AppLayout } from './routes/AppLayout';
import { ScanRoot } from './routes/ScanRoutes';
import { HistoryPage } from './routes/HistoryRoutes';
import { SettingsPage } from './routes/SettingsRoutes';
import SWUpdateToast from './sw-update';

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ScanProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="scan" replace />} />
              <Route path="scan" element={<ScanRoot />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
          <SWUpdateToast />
        </BrowserRouter>
      </ScanProvider>
    </QueryClientProvider>
  );
}
