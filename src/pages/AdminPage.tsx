import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, Users, Swords, Settings, Plus, X, Edit2, Database, Flag } from 'lucide-react';
import { Kit, KitType } from '../types';
import KitCard from '../components/KitCard';
import AdSettingsPanel from '../components/AdSettingsPanel';
import RobloxCookiePanel from '../components/RobloxCookiePanel';
import UserManagementPanel from '../components/admin/UserManagementPanel';
import RestrictedUsersManager from '../components/admin/RestrictedUsersManager';
import { PageAccessControlManager } from '../components/admin/PageAccessControlManager';
import ActivityPulseManager from '../components/admin/ActivityPulseManager';
import AdminReportPanel from '../components/AdminReportPanel';
import { TRUST_LEVEL_CONFIGS } from "../types/trustLevels";

interface AdminStats {
  totalUsers: number;
  totalStrategies: number;
  totalRatings: number;
  totalCounters: number;
}

const AdminPage = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'kits' | 'reports' | 'settings'>('overview');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalStrategies: 0,
    totalRatings: 0,
    totalCounters: 0
  });
  const [loading, setLoading] = useState(true);
  const [showKitModal, setShowKitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [kits, setKits] = useState<Kit[]>([]);
  const [kitSearch, setKitSearch] = useState('');
  const [newKit, setNewKit] = useState<Partial<Kit>>({
    name: '',
    imageUrl: '',
    type: 'Fighter',
    payLocked: false
  });
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const kitTypes: KitType[] = [
    'Fighter', 'Movement', 'Economy', 'Ranged',
    'Support', 'Destroyer', 'Tank', 'Defender'
  ];

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchKits();
    }
  }, [isAdmin]);

  const fetchKits = async () => {
    try {
      const { data, error } = await supabase
        .from('kits')
        .select('*')
        .order('name');

      if (error) throw error;
      setKits(data || []);
    } catch (error) {
      console.error('Error fetching kits:', error);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const [
        { count: userCount },
        { count: strategyCount },
        { count: ratingCount },
        { count: counterCount }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('strategies').select('*', { count: 'exact', head: true }),
        supabase.from('strategy_ratings').select('*', { count: 'exact', head: true }),
        supabase.from('strategy_counters').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        totalUsers: userCount || 0,
        totalStrategies: strategyCount || 0,
        totalRatings: ratingCount || 0,
        totalCounters: counterCount || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanImageUrl = (url: string) => {
    return url.split('/revision/latest')[0];
  };

  const handleAddKit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newKit.name || !newKit.imageUrl || !newKit.type) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const cleanedImageUrl = cleanImageUrl(newKit.imageUrl);
      
      const { data, error } = await supabase
        .from('kits')
        .insert({
          name: newKit.name,
          image_url: cleanedImageUrl,
          type: newKit.type,
          pay_locked: newKit.payLocked
        })
        .select()
        .single();

      if (error) throw error;

      setKits([...kits, data]);
      setSuccess('Kit added successfully');
      setNewKit({
        name: '',
        imageUrl: '',
        type: 'Fighter',
        payLocked: false
      });
      setShowKitModal(false);
    } catch (error) {
      console.error('Error adding kit:', error);
      setError('Failed to add kit');
    }
  };

  const handleEditKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKit) return;

    setError(null);
    setSuccess(null);

    try {
      const cleanedImageUrl = cleanImageUrl(editingKit.imageUrl);
      
      const { error } = await supabase
        .from('kits')
        .update({
          name: editingKit.name,
          image_url: cleanedImageUrl,
          type: editingKit.type,
          pay_locked: editingKit.payLocked
        })
        .eq('id', editingKit.id);

      if (error) throw error;

      setKits(kits.map(kit => 
        kit.id === editingKit.id ? {...editingKit, imageUrl: cleanedImageUrl} : kit
      ));
      setSuccess('Kit updated successfully');
      setShowEditModal(false);
      setEditingKit(null);
    } catch (error) {
      console.error('Error updating kit:', error);
      setError('Failed to update kit');
    }
  };

  const handleDeleteKit = async (kitId: string) => {
    try {
      const { error } = await supabase
        .from('kits')
        .delete()
        .eq('id', kitId);

      if (error) throw error;

      setKits(kits.filter(kit => kit.id !== kitId));
      setSuccess('Kit deleted successfully');
    } catch (error) {
      console.error('Error deleting kit:', error);
      setError('Failed to delete kit');
    }
  };

  const openEditModal = (kit: Kit) => {
    setEditingKit(kit);
    setShowEditModal(true);
  };

  const filteredKits = kits.filter(k =>
    k.name.toLowerCase().includes(kitSearch.toLowerCase())
  );

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Shield className="text-primary-600" size={24} />
          <span className="text-sm text-gray-600 dark:text-gray-400">Admin Access</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={16} />
              Overview
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'reports'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flag size={16} />
              Report Panel
              {/* Optional: Show unreviewed count badge */}
              <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs px-2 py-1 rounded-full ml-1">
                New
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('kits')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'kits'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Swords size={16} />
              Kit Management
            </div>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings size={16} />
              Settings
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                    <h3 className="text-2xl font-bold">{stats.totalUsers}</h3>
                  </div>
                  <Users className="text-blue-500" size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Strategies</p>
                    <h3 className="text-2xl font-bold">{stats.totalStrategies}</h3>
                  </div>
                  <Swords className="text-green-500" size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Strategy Ratings</p>
                    <h3 className="text-2xl font-bold">{stats.totalRatings}</h3>
                  </div>
                  <Settings className="text-purple-500" size={24} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Counter Strategies</p>
                    <h3 className="text-2xl font-bold">{stats.totalCounters}</h3>
                  </div>
                  <Shield className="text-orange-500" size={24} />
                </div>
              </div>
            </div>

            {/* User Management */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <UserManagementPanel />
              <div className="my-8">
                <div className="bg-base-200 rounded-2xl shadow-lg p-6 flex flex-col md:flex-row gap-6 items-center justify-center">
                  {TRUST_LEVEL_CONFIGS.map(config => (
                    <div key={config.level} className="flex flex-col items-center flex-1">
                      <span className="text-3xl mb-2">{config.icon}</span>
                      <span className="font-bold">{config.level} = {config.label}</span>
                      <span className="text-gray-400 text-sm text-center">{config.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              <RestrictedUsersManager />
            </div>

            {/* Activity Pulse Manager */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <ActivityPulseManager isAdmin={isAdmin} />
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <AdminReportPanel />
        )}

        {activeTab === 'kits' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Kit Management</h2>
                <button
                  onClick={() => setShowKitModal(true)}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add New Kit
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  {success}
                </div>
              )}

              <div className="mb-4">
                <input
                  type="text"
                  value={kitSearch}
                  onChange={(e) => setKitSearch(e.target.value)}
                  placeholder="Search kits..."
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredKits.map(kit => (
                  <div key={kit.id} className="relative group">
                    <KitCard kit={kit} />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(kit)}
                        className="p-1 bg-blue-500 rounded-full text-white hover:bg-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteKit(kit.id)}
                        className="p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <AdSettingsPanel />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <PageAccessControlManager />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <RobloxCookiePanel />
            </div>
          </div>
        )}
      </div>

      {showKitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Add New Kit</h3>
            
            <form onSubmit={handleAddKit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Kit Name</label>
                <input
                  type="text"
                  value={newKit.name}
                  onChange={(e) => setNewKit({ ...newKit, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="url"
                  value={newKit.imageUrl}
                  onChange={(e) => setNewKit({ ...newKit, imageUrl: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                  placeholder="https://static.wikia.nocookie.net/robloxbedwars/images/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full image URL from the wiki
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Kit Type</label>
                <select
                  value={newKit.type}
                  onChange={(e) => setNewKit({ ...newKit, type: e.target.value as KitType })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                >
                  {kitTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="payLocked"
                  checked={newKit.payLocked}
                  onChange={(e) => setNewKit({ ...newKit, payLocked: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="payLocked" className="ml-2 text-sm">
                  Pay-locked Kit
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowKitModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Kit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingKit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Edit Kit</h3>
            
            <form onSubmit={handleEditKit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Kit Name</label>
                <input
                  type="text"
                  value={editingKit.name}
                  onChange={(e) => setEditingKit({ ...editingKit, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="url"
                  value={editingKit.imageUrl}
                  onChange={(e) => setEditingKit({ ...editingKit, imageUrl: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                  placeholder="https://static.wikia.nocookie.net/robloxbedwars/images/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste the full image URL from the wiki
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Kit Type</label>
                <select
                  value={editingKit.type}
                  onChange={(e) => setEditingKit({ ...editingKit, type: e.target.value as KitType })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                >
                  {kitTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editPayLocked"
                  checked={editingKit.payLocked}
                  onChange={(e) => setEditingKit({ ...editingKit, payLocked: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="editPayLocked" className="ml-2 text-sm">
                  Pay-locked Kit
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingKit(null);
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
