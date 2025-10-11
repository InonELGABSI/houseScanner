import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ScanProvider } from './context/ScanContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ScanPage } from './pages/scan/ScanPage';
import { HistoryPage } from './pages/history/HistoryPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ScanSummaryPage } from './pages/summary/ScanSummaryPage';
import SWUpdateToast from './sw-update';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        return failureCount < 3;
      },
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ScanProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/scan" replace />} />
                <Route path="scan" element={<ScanPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="summary/:scanId" element={<ScanSummaryPage />} />
              </Route>
            </Routes>
            <SWUpdateToast />
          </BrowserRouter>
        </ScanProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
