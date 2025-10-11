import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();

  // Hide bottom nav on certain pages
  const hideBottomNav = location.pathname.includes('/summary/');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            House Scanner
          </h1>
          {user && (
            <div className="text-sm text-slate-400">
              {user.firstName} {user.lastName}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-w-md mx-auto w-full">
        <div className={`min-h-full ${!hideBottomNav ? 'pb-20' : 'pb-4'}`}>
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-slate-800/90 backdrop-blur-md border-t border-slate-700/50 px-4 py-3 z-50">
          <div className="flex justify-around">
            {[
              { to: '/scan', label: 'Scan', icon: '📷' },
              { to: '/history', label: 'History', icon: '📋' },
              { to: '/settings', label: 'Settings', icon: '⚙️' },
            ].map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'text-emerald-400 bg-emerald-900/20 shadow-lg' 
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700/50'
                  }`
                }
              >
                <span className="text-lg mb-1">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}