import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../api/users';
import { checklistsAPI, Checklist } from '../../api/checklists';

type ChecklistScope = 'house' | 'room' | 'product';

type ChecklistSubitemForm = {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  options?: string[];
};

type ChecklistItemForm = {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  options?: string[];
  appliesTo?: string;
  subitems?: ChecklistSubitemForm[];
};

type ChecklistStructure = Record<string, any> | null;

const TYPE_GROUP_KEYS: Record<Exclude<ChecklistScope, 'product'>, string> = {
  house: 'house_types',
  room: 'room_types',
};

const deepClone = <T,>(value: T): T => {
  if (value === null || value === undefined) {
    return value as T;
  }
  return JSON.parse(JSON.stringify(value));
};

const createEmptyStructure = (scope: ChecklistScope): Record<string, any> => {
  if (scope === 'product') {
    return { items: [] };
  }

  const typeKey = TYPE_GROUP_KEYS[scope];
  return {
    default: {
      description: '',
      items: [],
    },
    [typeKey]: {},
  };
};

const flattenChecklistItems = (
  scope: ChecklistScope,
  structure: ChecklistStructure,
): ChecklistItemForm[] => {
  if (!structure) {
    return [];
  }

  if (Array.isArray(structure)) {
    return structure as ChecklistItemForm[];
  }

  if (Array.isArray((structure as any).items)) {
    return deepClone((structure as any).items);
  }

  if (scope === 'product') {
    return [];
  }

  const items: ChecklistItemForm[] = [];
  const defaultItems = structure?.default?.items;

  if (Array.isArray(defaultItems)) {
    defaultItems.forEach((item: ChecklistItemForm) => {
      items.push({ ...deepClone(item), appliesTo: 'default' });
    });
  }

  const typeKey = TYPE_GROUP_KEYS[scope];
  const typeGroups = structure?.[typeKey];

  if (typeGroups && typeof typeGroups === 'object') {
    Object.entries(typeGroups).forEach(([type, group]) => {
      const groupItems = (group as any)?.items;
      if (Array.isArray(groupItems)) {
        groupItems.forEach((item: ChecklistItemForm) => {
          items.push({ ...deepClone(item), appliesTo: type });
        });
      }
    });
  }

  return items;
};

const buildStructuredChecklist = (
  scope: ChecklistScope,
  items: ChecklistItemForm[],
  structureSource: ChecklistStructure,
): Record<string, any> => {
  if (scope === 'product') {
    return {
      items: items.map((item) => {
        const cloned = { ...deepClone(item) };
        delete cloned.appliesTo;
        return cloned;
      }),
      description: (structureSource as any)?.description || 'Custom product checklist',
    };
  }

  const typeKey = TYPE_GROUP_KEYS[scope];
  const result: Record<string, any> = {
    default: {
      items: [],
      description: (structureSource as any)?.default?.description || `Checklist items relevant to all ${scope} types`,
    },
    [typeKey]: {},
  };

  // Group items by their target
  const itemsByTarget: Record<string, ChecklistItemForm[]> = {};

  items.forEach((item) => {
    const target = item.appliesTo && item.appliesTo !== 'default'
      ? item.appliesTo
      : 'default';
    
    if (!itemsByTarget[target]) {
      itemsByTarget[target] = [];
    }

    const cloned = { ...deepClone(item) };
    delete cloned.appliesTo;
    itemsByTarget[target].push(cloned);
  });

  // Populate default items
  if (itemsByTarget['default']) {
    result.default.items = itemsByTarget['default'];
  }

  // Populate type-specific items (only for types that have items)
  Object.entries(itemsByTarget).forEach(([target, targetItems]) => {
    if (target !== 'default' && targetItems.length > 0) {
      // Try to preserve description from the base structure if available
      const baseTypeData = (structureSource as any)?.[typeKey]?.[target];
      const description = baseTypeData?.description || `${target} specific items`;

      result[typeKey][target] = {
        items: targetItems,
        description,
      };
    }
  });

  return result;
};

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<'house' | 'room' | 'product' | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentItemsRaw, setCurrentItemsRaw] = useState<Record<string, any> | null>(null);
  
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });

  const [checklistForm, setChecklistForm] = useState<{
    name: string;
    items: any[];
  }>({
    name: '',
    items: [],
  });

  const [baseChecklists, setBaseChecklists] = useState<Record<string, any>>({});

  useEffect(() => {
    loadChecklists();
    if (user?.role === 'admin') {
      loadBaseChecklists();
    }
  }, [user?.role]);

  const loadChecklists = async () => {
    try {
      const data = await usersAPI.getMyChecklists();
      setChecklists(data);
    } catch (error) {
      console.error('Failed to load checklists:', error);
    }
  };

  const loadBaseChecklists = async () => {
    try {
      const scopes: Array<'house' | 'room' | 'product'> = ['house', 'room', 'product'];
      const loaded: Record<string, any> = {};
      
      for (const scope of scopes) {
        const baseChecklist = await checklistsAPI.getBaseChecklist(scope);
        if (baseChecklist) {
          loaded[scope] = baseChecklist;
        }
      }
      
      setBaseChecklists(loaded);
    } catch (error) {
      console.error('Failed to load base checklists:', error);
    }
  };

  const handleDownloadBaseChecklist = (scope: string) => {
    const base = baseChecklists[scope];
    if (!base) return;

    const dataStr = JSON.stringify(base.itemsRaw, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scope}_type_checklist.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    // TODO: Implement account deletion
    console.log('Delete account requested');
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await usersAPI.updateMe(profileForm);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setEditingProfile(false);
      window.location.reload(); // Reload to update auth context
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditChecklist = async (scope: 'house' | 'room' | 'product') => {
    const existing = checklists.find((c) => c.scope === scope);

    const existingItemsRaw = existing?.itemsRaw
      ? (deepClone(existing.itemsRaw) as ChecklistStructure)
      : null;

    let baseStructure: ChecklistStructure = baseChecklists[scope]?.itemsRaw
      ? (deepClone(baseChecklists[scope].itemsRaw) as ChecklistStructure)
      : null;

    if (!baseStructure) {
      try {
        const fetchedBase = await checklistsAPI.getBaseChecklist(scope);
        if (fetchedBase?.itemsRaw) {
          baseStructure = deepClone(fetchedBase.itemsRaw) as ChecklistStructure;
          setBaseChecklists((prev) => ({
            ...prev,
            [scope]: fetchedBase,
          }));
        }
      } catch (error) {
        console.error('Failed to load base checklist for scope', scope, error);
      }
    }

    const structureTemplate = existingItemsRaw ?? baseStructure ?? createEmptyStructure(scope);

    let items: ChecklistItemForm[] = [];

    if (existingItemsRaw) {
      items = flattenChecklistItems(scope, existingItemsRaw);
    } else if (existing?.itemsRaw) {
      const raw = existing.itemsRaw as any;
      if (Array.isArray(raw)) {
        items = deepClone(raw);
      } else if (raw.items && Array.isArray(raw.items)) {
        items = deepClone(raw.items);
      }
    }

    setCurrentItemsRaw(structureTemplate ? deepClone(structureTemplate) : null);

    setChecklistForm({
      name: existing?.name || `Custom ${scope} checklist`,
      items,
    });
    setEditingChecklist(scope);
  };

  const handleSaveChecklist = async () => {
    if (!editingChecklist) return;
    
    setLoading(true);
    setMessage(null);
    try {
      const itemsRaw = buildStructuredChecklist(
        editingChecklist,
        checklistForm.items as ChecklistItemForm[],
        currentItemsRaw ?? (baseChecklists[editingChecklist]?.itemsRaw as ChecklistStructure ?? null),
      );

      await checklistsAPI.upsertByScope(editingChecklist, {
        name: checklistForm.name,
        itemsRaw,
      });
      
      setMessage({ type: 'success', text: 'Checklist saved successfully!' });
      setEditingChecklist(null);
      setCurrentItemsRaw(null);
      loadChecklists();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save checklist' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const appliesToValue = editingChecklist && editingChecklist !== 'product' ? 'default' : undefined;

    setChecklistForm({
      ...checklistForm,
      items: [
        ...checklistForm.items,
        {
          id: `item_${Date.now()}`,
          title: '',
          type: 'boolean',
          description: '',
          appliesTo: appliesToValue,
        },
      ],
    });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...checklistForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setChecklistForm({ ...checklistForm, items: newItems });
  };

  const handleDeleteItem = (index: number) => {
    const newItems = checklistForm.items.filter((_, i) => i !== index);
    setChecklistForm({ ...checklistForm, items: newItems });
  };

  const handleAddSubitem = (itemIndex: number) => {
    const newItems = [...checklistForm.items];
    if (!newItems[itemIndex].subitems) {
      newItems[itemIndex].subitems = [];
    }
    newItems[itemIndex].subitems.push({
      id: `subitem_${Date.now()}`,
      title: '',
      type: 'categorical',
      options: ['Poor', 'Average', 'Good', 'Excellent'],
    });
    setChecklistForm({ ...checklistForm, items: newItems });
  };

  const handleUpdateSubitem = (itemIndex: number, subitemIndex: number, field: string, value: any) => {
    const newItems = [...checklistForm.items];
    newItems[itemIndex].subitems[subitemIndex] = {
      ...newItems[itemIndex].subitems[subitemIndex],
      [field]: value,
    };
    setChecklistForm({ ...checklistForm, items: newItems });
  };

  const handleDeleteSubitem = (itemIndex: number, subitemIndex: number) => {
    const newItems = [...checklistForm.items];
    newItems[itemIndex].subitems = newItems[itemIndex].subitems.filter((_: any, i: number) => i !== subitemIndex);
    setChecklistForm({ ...checklistForm, items: newItems });
  };

  const handleBaseChecklistUpload = async (scope: 'house' | 'room' | 'product', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      await checklistsAPI.updateBaseChecklist(scope, {
        name: `Base ${scope} checklist`,
        version: 1,
        itemsRaw: jsonData,
      });

      setMessage({ type: 'success', text: `Base ${scope} checklist updated successfully!` });
      loadBaseChecklists(); // Reload to show updated status
    } catch (error) {
      console.error('Failed to upload checklist:', error);
      setMessage({ type: 'error', text: 'Failed to upload checklist. Please check the JSON format.' });
    } finally {
      setLoading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const getChecklistEmoji = (scope: string) => {
    switch (scope) {
      case 'house': return '🏠';
      case 'room': return '🚪';
      case 'product': return '🛋️';
      default: return '📋';
    }
  };

  const getChecklistLabel = (scope: string) => {
    switch (scope) {
      case 'house': return 'House Type Checklist';
      case 'room': return 'Room Type Checklist';
      case 'product': return 'Product Checklist';
      default: return 'Custom Checklist';
    }
  };

  const getChecklistDescription = (scope: string) => {
    switch (scope) {
      case 'house': return 'Configure house categories';
      case 'room': return 'Manage room categories';
      case 'product': return 'Furniture and appliance types';
      default: return 'Custom items';
    }
  };

  const getSubTypeOptions = (scope: string) => {
    if (scope === 'house') {
      return [
        { value: 'default', label: 'Default (All Houses)' },
        { value: 'apartment', label: 'Apartment' },
        { value: 'villa', label: 'Villa' },
        { value: 'townhouse', label: 'Townhouse' },
        { value: 'studio', label: 'Studio' },
        { value: 'penthouse', label: 'Penthouse' },
      ];
    } else if (scope === 'room') {
      return [
        { value: 'default', label: 'Default (All Rooms)' },
        { value: 'bedroom', label: 'Bedroom' },
        { value: 'living_room', label: 'Living Room' },
        { value: 'kitchen', label: 'Kitchen' },
        { value: 'bathroom', label: 'Bathroom' },
        { value: 'office', label: 'Office' },
      ];
    }
    return [{ value: 'default', label: 'Default' }];
  };

  return (
    <div className="min-h-full p-4 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent mb-2">
          Settings
        </h1>
        <p className="text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400'
            : 'bg-red-900/20 border-red-700/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* User Profile */}
      <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700/50">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-200">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
              user?.role === 'admin' 
                ? 'bg-purple-900/30 text-purple-400 border border-purple-700/30'
                : user?.role === 'manager'
                ? 'bg-blue-900/30 text-blue-400 border border-blue-700/30'
                : 'bg-gray-900/30 text-gray-400 border border-gray-700/30'
            }`}>
              {user?.role === 'admin' && '👑 Admin'}
              {user?.role === 'manager' && '🏢 Manager'}
              {user?.role === 'user' && '👤 User'}
            </span>
          </div>
        </div>
        
        {!editingProfile ? (
          <button
            onClick={() => setEditingProfile(true)}
            className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
          >
            ✏️ Edit Profile
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">First Name</label>
              <input
                type="text"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Last Name</label>
              <input
                type="text"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setEditingProfile(false)}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProfile}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Base Checklist Settings (Admin Only) */}
        {user?.role === 'admin' && (
          <div>
            <h3 className="text-lg font-semibold text-slate-200 mb-4">� Base Checklists (Admin)</h3>
            <p className="text-xs text-slate-400 mb-3">
              Upload JSON files to set the default checklists for all users
            </p>
            <div className="space-y-3">
              {['house', 'room', 'product'].map((scope) => (
                <div key={scope} className="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg border border-purple-700/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getChecklistEmoji(scope)}</span>
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">{getChecklistLabel(scope)}</div>
                      <div className="text-xs text-slate-400">
                        {baseChecklists[scope] ? (
                          <span className="text-emerald-400">✓ Base checklist loaded (v{baseChecklists[scope].version})</span>
                        ) : (
                          <span>No base checklist set</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {baseChecklists[scope] && (
                      <button
                        onClick={() => handleDownloadBaseChecklist(scope)}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-xs font-medium rounded-lg transition-colors"
                        title="Download current base checklist"
                      >
                        📥
                      </button>
                    )}
                    <label className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-xs font-medium rounded-lg transition-colors cursor-pointer">
                      📤 Upload
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleBaseChecklistUpload(scope as 'house' | 'room' | 'product', e)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist Settings */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">📋 My Custom Checklists</h3>
          <div className="space-y-3">
            {['house', 'room', 'product'].map((scope) => (
              <div key={scope} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getChecklistEmoji(scope)}</span>
                  <div>
                    <div className="font-medium text-slate-200">{getChecklistLabel(scope)}</div>
                    <div className="text-xs text-slate-400">{getChecklistDescription(scope)}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleEditChecklist(scope as 'house' | 'room' | 'product')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium rounded-lg transition-colors"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* About Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">ℹ️ About</h3>
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex justify-between">
                <span>Version</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>Build</span>
                <span>2025.01.08</span>
              </div>
              <div className="flex justify-between">
                <span>Support</span>
                <a href="mailto:support@housescanner.com" className="text-emerald-400 hover:text-emerald-300">
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Account Actions */}
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">🔐 Account</h3>
          <div className="space-y-3">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full p-3 bg-slate-700/30 hover:bg-slate-600/30 rounded-lg border border-slate-600/30 text-slate-300 font-medium transition-colors"
            >
              🚪 Sign Out
            </button>
            
            <button
              onClick={handleDeleteAccount}
              className="w-full p-3 bg-red-900/20 hover:bg-red-900/30 rounded-lg border border-red-700/30 text-red-300 font-medium transition-colors"
            >
              🗑️ Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-sm w-full border border-slate-700">
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Sign Out</h3>
            <p className="text-slate-400 mb-6">Are you sure you want to sign out?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Checklist Modal */}
      {editingChecklist && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full border border-slate-700 my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-200">
                {getChecklistEmoji(editingChecklist)} Edit {getChecklistLabel(editingChecklist)}
              </h3>
              <button
                onClick={() => {
                  setEditingChecklist(null);
                  setCurrentItemsRaw(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Checklist Name</label>
                <input
                  type="text"
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                  placeholder="Enter checklist name"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300">Checklist Items</label>
                  <button
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
                {editingChecklist !== 'product' && (
                  <p className="text-xs text-slate-400 mb-3">
                    💡 Each item can apply to all {editingChecklist === 'house' ? 'house' : 'room'} types (Default) or specific types only
                  </p>
                )}

                {checklistForm.items.length === 0 && (
                  <div className="text-center py-8 text-slate-400 bg-slate-700/20 rounded-lg border border-slate-600/30">
                    No items yet. Click "Add Item" to create your first checklist item.
                  </div>
                )}

                <div className="space-y-4">
                  {checklistForm.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-400">Item #{itemIndex + 1}</span>
                          {item.appliesTo && item.appliesTo !== 'default' && (
                            <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded border border-blue-700/30">
                              {getSubTypeOptions(editingChecklist || '').find(opt => opt.value === item.appliesTo)?.label}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteItem(itemIndex)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">ID</label>
                          <input
                            type="text"
                            value={item.id || ''}
                            onChange={(e) => handleUpdateItem(itemIndex, 'id', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="unique_id"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Type</label>
                          <select
                            value={item.type || 'boolean'}
                            onChange={(e) => handleUpdateItem(itemIndex, 'type', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                          >
                            <option value="boolean">Boolean (Yes/No)</option>
                            <option value="categorical">Categorical (Options)</option>
                            <option value="conditional">Conditional (With Subitems)</option>
                          </select>
                        </div>
                        {editingChecklist !== 'product' && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">
                              {editingChecklist === 'house' ? 'House Type' : 'Room Type'}
                            </label>
                            <select
                              value={item.appliesTo || 'default'}
                              onChange={(e) => handleUpdateItem(itemIndex, 'appliesTo', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                            >
                              {getSubTypeOptions(editingChecklist || '').map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-slate-400 mb-1">Title</label>
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => handleUpdateItem(itemIndex, 'title', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                          placeholder="Item title"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-slate-400 mb-1">Description</label>
                        <textarea
                          value={item.description || ''}
                          onChange={(e) => handleUpdateItem(itemIndex, 'description', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                          rows={2}
                          placeholder="Item description"
                        />
                      </div>

                      {item.type === 'categorical' && (
                        <div className="mb-3">
                          <label className="block text-xs text-slate-400 mb-1">Options (comma-separated)</label>
                          <input
                            type="text"
                            value={item.options ? item.options.join(', ') : ''}
                            onChange={(e) => handleUpdateItem(itemIndex, 'options', e.target.value.split(',').map((s: string) => s.trim()))}
                            className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500 rounded text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                            placeholder="Poor, Average, Good, Excellent"
                          />
                        </div>
                      )}

                      {item.type === 'conditional' && (
                        <div className="mt-3 pl-4 border-l-2 border-emerald-500/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-slate-400">Subitems</span>
                            <button
                              onClick={() => handleAddSubitem(itemIndex)}
                              className="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs rounded transition-colors"
                            >
                              + Add Subitem
                            </button>
                          </div>

                          <div className="space-y-2">
                            {item.subitems?.map((subitem: any, subitemIndex: number) => (
                              <div key={subitemIndex} className="bg-slate-600/20 rounded p-3 border border-slate-500/30">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="text-xs text-emerald-300">Subitem #{subitemIndex + 1}</span>
                                  <button
                                    onClick={() => handleDeleteSubitem(itemIndex, subitemIndex)}
                                    className="text-red-400 hover:text-red-300 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">ID</label>
                                    <input
                                      type="text"
                                      value={subitem.id || ''}
                                      onChange={(e) => handleUpdateSubitem(itemIndex, subitemIndex, 'id', e.target.value)}
                                      className="w-full px-2 py-1 bg-slate-700/50 border border-slate-500 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                                      placeholder="subitem_id"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Type</label>
                                    <select
                                      value={subitem.type || 'categorical'}
                                      onChange={(e) => handleUpdateSubitem(itemIndex, subitemIndex, 'type', e.target.value)}
                                      className="w-full px-2 py-1 bg-slate-700/50 border border-slate-500 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                                    >
                                      <option value="categorical">Categorical</option>
                                      <option value="boolean">Boolean</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="mb-2">
                                  <label className="block text-xs text-slate-400 mb-1">Title</label>
                                  <input
                                    type="text"
                                    value={subitem.title || ''}
                                    onChange={(e) => handleUpdateSubitem(itemIndex, subitemIndex, 'title', e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-700/50 border border-slate-500 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                                    placeholder="Subitem title"
                                  />
                                </div>

                                {subitem.type === 'categorical' && (
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Options (comma-separated)</label>
                                    <input
                                      type="text"
                                      value={subitem.options ? subitem.options.join(', ') : ''}
                                      onChange={(e) => handleUpdateSubitem(itemIndex, subitemIndex, 'options', e.target.value.split(',').map((s: string) => s.trim()))}
                                      className="w-full px-2 py-1 bg-slate-700/50 border border-slate-500 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                                      placeholder="Poor, Average, Good, Excellent"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => {
                  setEditingChecklist(null);
                  setCurrentItemsRaw(null);
                }}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChecklist}
                className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}