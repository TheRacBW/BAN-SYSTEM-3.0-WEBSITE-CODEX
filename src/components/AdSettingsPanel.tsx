import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Save, Plus, Trash2, Edit2, X } from 'lucide-react';

interface CustomAd {
  id: string;
  name: string;
  image_url: string;
  link_url: string;
  enabled: boolean;
  weight: number;
}

const AdSettingsPanel: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [adType, setAdType] = useState<'google' | 'custom'>('google');
  const [adClient, setAdClient] = useState('');
  const [adSlot, setAdSlot] = useState('');
  const [customAds, setCustomAds] = useState<CustomAd[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAd, setEditingAd] = useState<CustomAd | null>(null);
  const [newAd, setNewAd] = useState<Partial<CustomAd>>({
    name: '',
    image_url: '',
    link_url: '',
    enabled: true,
    weight: 1
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [{ data: settings }, { data: ads }] = await Promise.all([
          supabase
            .from('ad_settings')
            .select('*')
            .eq('id', 'global')
            .single(),
          supabase
            .from('custom_ads')
            .select('*')
            .order('created_at', { ascending: false })
        ]);

        if (settings) {
          setEnabled(settings.enabled);
          setAdType(settings.ad_type || 'google');
          setAdClient(settings.ad_client || '');
          setAdSlot(settings.ad_slot || '');
        }

        if (ads) {
          setCustomAds(ads);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to changes
    const subscription = supabase
      .channel('custom_ads_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'custom_ads' 
        }, 
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('ad_settings')
        .update({
          enabled,
          ad_type: adType,
          ad_client: adClient,
          ad_slot: adSlot,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global');

      if (error) throw error;

      setSuccess('Ad settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings');
    }
  };

  const handleAddAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newAd.name || !newAd.image_url || !newAd.link_url) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_ads')
        .insert(newAd);

      if (error) throw error;

      setShowAddModal(false);
      setNewAd({
        name: '',
        image_url: '',
        link_url: '',
        enabled: true,
        weight: 1
      });
      setSuccess('Ad added successfully');
    } catch (err) {
      console.error('Error adding ad:', err);
      setError('Failed to add ad');
    }
  };

  const handleEditAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd) return;

    try {
      const { error } = await supabase
        .from('custom_ads')
        .update({
          name: editingAd.name,
          image_url: editingAd.image_url,
          link_url: editingAd.link_url,
          enabled: editingAd.enabled,
          weight: editingAd.weight,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingAd.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingAd(null);
      setSuccess('Ad updated successfully');
    } catch (err) {
      console.error('Error updating ad:', err);
      setError('Failed to update ad');
    }
  };

  const handleDeleteAd = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Ad deleted successfully');
    } catch (err) {
      console.error('Error deleting ad:', err);
      setError('Failed to delete ad');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Advertisement Settings</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center">
          <AlertCircle className="mr-2" size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="enabled" className="ml-2 block text-sm font-medium">
            Enable Advertisements
          </label>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Ad Type</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="google"
                checked={adType === 'google'}
                onChange={(e) => setAdType(e.target.value as 'google' | 'custom')}
                className="mr-2"
              />
              Google AdSense
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="custom"
                checked={adType === 'custom'}
                onChange={(e) => setAdType(e.target.value as 'google' | 'custom')}
                className="mr-2"
              />
              Custom Ads
            </label>
          </div>
        </div>

        {adType === 'google' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="adClient">
                Google AdSense Client ID
              </label>
              <input
                type="text"
                id="adClient"
                value={adClient}
                onChange={(e) => setAdClient(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                placeholder="ca-pub-xxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="adSlot">
                Ad Slot ID
              </label>
              <input
                type="text"
                id="adSlot"
                value={adSlot}
                onChange={(e) => setAdSlot(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                placeholder="xxxxxxxxxx"
              />
            </div>
          </>
        )}

        {adType === 'custom' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Custom Ads</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                Add New Ad
              </button>
            </div>

            <div className="space-y-4">
              {customAds.map(ad => (
                <div
                  key={ad.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={ad.image_url}
                      alt={ad.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div>
                      <h4 className="font-medium">{ad.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Weight: {ad.weight} | {ad.enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAd(ad);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAd(ad.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary flex items-center gap-2"
        >
          <Save size={18} />
          Save Settings
        </button>
      </form>

      {/* Add Ad Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add New Ad</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddAd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ad Name
                </label>
                <input
                  type="text"
                  value={newAd.name}
                  onChange={(e) => setNewAd({ ...newAd, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={newAd.image_url}
                  onChange={(e) => setNewAd({ ...newAd, image_url: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Link URL
                </label>
                <input
                  type="url"
                  value={newAd.link_url}
                  onChange={(e) => setNewAd({ ...newAd, link_url: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Weight (1-10)
                </label>
                <input
                  type="number"
                  value={newAd.weight}
                  onChange={(e) => setNewAd({ ...newAd, weight: parseInt(e.target.value) })}
                  min="1"
                  max="10"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="newAdEnabled"
                  checked={newAd.enabled}
                  onChange={(e) => setNewAd({ ...newAd, enabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="newAdEnabled" className="ml-2 text-sm">
                  Enable this ad
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Ad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ad Modal */}
      {showEditModal && editingAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Edit Ad</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAd(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditAd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ad Name
                </label>
                <input
                  type="text"
                  value={editingAd.name}
                  onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={editingAd.image_url}
                  onChange={(e) => setEditingAd({ ...editingAd, image_url: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Link URL
                </label>
                <input
                  type="url"
                  value={editingAd.link_url}
                  onChange={(e) => setEditingAd({ ...editingAd, link_url: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Weight (1-10)
                </label>
                <input
                  type="number"
                  value={editingAd.weight}
                  onChange={(e) => setEditingAd({ ...editingAd, weight: parseInt(e.target.value) })}
                  min="1"
                  max="10"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editAdEnabled"
                  checked={editingAd.enabled}
                  onChange={(e) => setEditingAd({ ...editingAd, enabled: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="editAdEnabled" className="ml-2 text-sm">
                  Enable this ad
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAd(null);
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

export default AdSettingsPanel;