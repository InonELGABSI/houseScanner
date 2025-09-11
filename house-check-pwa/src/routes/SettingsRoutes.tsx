export function SettingsPage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-slate-400">Configure your house scanning preferences</p>
      </div>

      {/* Settings Cards */}
      <div className="space-y-4">
        {/* Checklist Settings */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📋</span>
            <h2 className="text-lg font-semibold text-slate-200">Checklist Configuration</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Customize the checklists used during house analysis
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">🏠</span>
                <div>
                  <div className="font-medium text-slate-200">House Type Checklist</div>
                  <div className="text-xs text-slate-400">Define house categories and types</div>
                </div>
              </div>
              <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-lg transition-colors">
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚪</span>
                <div>
                  <div className="font-medium text-slate-200">Room Type Checklist</div>
                  <div className="text-xs text-slate-400">Specify room categories and features</div>
                </div>
              </div>
              <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-lg transition-colors">
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">🛋️</span>
                <div>
                  <div className="font-medium text-slate-200">Product Checklist</div>
                  <div className="text-xs text-slate-400">Furniture and appliance categories</div>
                </div>
              </div>
              <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-lg transition-colors">
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">⭐</span>
                <div>
                  <div className="font-medium text-slate-200">Custom User Checklist</div>
                  <div className="text-xs text-slate-400">Your personalized checklist items</div>
                </div>
              </div>
              <button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-lg transition-colors">
                Configure
              </button>
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-lg font-semibold text-slate-200">App Preferences</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">🌙</span>
                <div>
                  <div className="font-medium text-slate-200">Dark Mode</div>
                  <div className="text-xs text-slate-400">Currently enabled</div>
                </div>
              </div>
              <div className="w-12 h-6 bg-emerald-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5"></div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔔</span>
                <div>
                  <div className="font-medium text-slate-200">Notifications</div>
                  <div className="text-xs text-slate-400">Scan completion alerts</div>
                </div>
              </div>
              <div className="w-12 h-6 bg-slate-600 rounded-full relative">
                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5"></div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">ℹ️</span>
            <h2 className="text-lg font-semibold text-slate-200">About House Scanner</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-400">
            <p>Version 1.0.0</p>
            <p>AI-powered house analysis tool</p>
            <p>Built with React, TypeScript, and Tailwind CSS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
