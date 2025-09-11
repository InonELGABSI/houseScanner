import { Outlet, NavLink } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            House Scanner
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700/50 flex justify-around py-3 text-sm shadow-lg">
        {[
          { to: '/scan', label: 'Scan', icon: '📷' },
          { to: '/history', label: 'History', icon: '📋' },
          { to: '/settings', label: 'Settings', icon: '⚙️' },
        ].map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) =>
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
      </nav>
    </div>
  );
}
