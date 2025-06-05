import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useKits } from '../context/KitContext';
import { supabase } from '../lib/supabase';
import StrategyCard from '../components/StrategyCard';
import KitCard from '../components/KitCard';
import { Plus, Bookmark, Trash2, Save, Search, X, Check } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  effectiveness: number;
  counterability: number;
  win_rate: number;
  is_public: boolean;
  created_at: string;
  kit_ids: string[];
  user_id: string;
}

interface KitPreset {
  id: string;
  name: string;
  kit_ids: string[];
}

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { kits, getSortedKits } = useKits();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [savedStrategies, setSavedStrategies] = useState<Strategy[]>([]);
  const [ownedKits, setOwnedKits] = useState<string[]>([]);
  const [presets, setPresets] = useState<KitPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');

  const filteredKits = kits.filter(kit => 
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedKitGroups = getSortedKits(filteredKits);

  useEffect(() => {
    if (user) {
      fetchUserStrategies();
      fetchSavedStrategies();
      fetchOwnedKits();
      fetchPresets();
    }
  }, [user]);

  const fetchUserStrategies = async () => {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*, user_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching user strategies:', error);
      setError('Failed to load your strategies');
    }
  };

  const fetchSavedStrategies = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_strategies')
        .select(`
          strategy_id,
          strategies (
            id,
            name,
            description,
            effectiveness,
            counterability,
            win_rate,
            is_public,
            created_at,
            kit_ids,
            user_id
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      const savedStrategiesData = data?.map(item => item.strategies) || [];
      setSavedStrategies(savedStrategiesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching saved strategies:', error);
      setError('Failed to load saved strategies');
      setLoading(false);
    }
  };

  const fetchOwnedKits = async () => {
    try {
      const { data, error } = await supabase
        .from('owned_kits')
        .select('kit_id')
        .eq('user_id', user?.id);

      if (error) throw error;
      setOwnedKits(data.map(item => item.kit_id));
    } catch (error) {
      console.error('Error fetching owned kits:', error);
    }
  };

  const fetchPresets = async () => {
    try {
      const { data, error } = await supabase
        .from('kit_presets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPresets(data || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  const toggleKitOwnership = async (kitId: string) => {
    try {
      if (ownedKits.includes(kitId)) {
        const { error } = await supabase
          .from('owned_kits')
          .delete()
          .eq('user_id', user?.id)
          .eq('kit_id', kitId);

        if (error) throw error;
        setOwnedKits(prev => prev.filter(id => id !== kitId));
      } else {
        const { error } = await supabase
          .from('owned_kits')
          .insert({ user_id: user?.id, kit_id: kitId });

        if (error) throw error;
        setOwnedKits(prev => [...prev, kitId]);
      }
    } catch (error) {
      console.error('Error toggling kit ownership:', error);
      setError('Failed to update kit ownership');
    }
  };

  const savePreset = async () => {
    if (saveMode === 'new' && !newPresetName.trim()) {
      setError('Please enter an account name');
      return;
    }

    if (saveMode === 'existing' && !selectedPreset) {
      setError('Please select an account to save to');
      return;
    }

    try {
      if (saveMode === 'new') {
        const { error } = await supabase
          .from('kit_presets')
          .insert({
            user_id: user?.id,
            name: newPresetName.trim(),
            kit_ids: ownedKits
          });

        if (error) throw error;

        setSuccess('Account kits saved successfully');
        setNewPresetName('');
      } else {
        const { error } = await supabase
          .from('kit_presets')
          .update({ kit_ids: ownedKits })
          .eq('id', selectedPreset)
          .eq('user_id', user?.id);

        if (error) throw error;

        setSuccess('Account kits updated successfully');
      }

      setShowPresetModal(false);
      fetchPresets();
    } catch (error) {
      console.error('Error saving preset:', error);
      setError('Failed to save account kits');
    }
  };

  const loadPreset = async (preset: KitPreset) => {
    try {
      // First, remove all current owned kits
      await supabase
        .from('owned_kits')
        .delete()
        .eq('user_id', user?.id);

      // Then insert the new ones from the preset
      const { error } = await supabase
        .from('owned_kits')
        .insert(
          preset.kit_ids.map(kitId => ({
            user_id: user?.id,
            kit_id: kitId
          }))
        );

      if (error) throw error;

      setOwnedKits(preset.kit_ids);
      setSuccess('Preset loaded successfully');
    } catch (error) {
      console.error('Error loading preset:', error);
      setError('Failed to load preset');
    }
  };

  const deletePreset = async (presetId: string) => {
    try {
      const { error } = await supabase
        .from('kit_presets')
        .delete()
        .eq('id', presetId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setPresets(prev => prev.filter(p => p.id !== presetId));
      setSuccess('Preset deleted successfully');
    } catch (error) {
      console.error('Error deleting preset:', error);
      setError('Failed to delete preset');
    }
  };

  const handleRemoveStrategy = async (strategyId: string) => {
    try {
      setError(null);
      
      // Delete strategy ratings first
      const { error: ratingsError } = await supabase
        .from('strategy_ratings')
        .delete()
        .eq('strategy_id', strategyId);

      if (ratingsError) throw ratingsError;

      // Delete saved strategies
      const { error: savedError } = await supabase
        .from('saved_strategies')
        .delete()
        .eq('strategy_id', strategyId);

      if (savedError) throw savedError;

      // Delete strategy counters where this is the base strategy
      const { error: countersBaseError } = await supabase
        .from('strategy_counters')
        .delete()
        .eq('base_strategy_id', strategyId);

      if (countersBaseError) throw countersBaseError;

      // Delete strategy counters where this is the counter strategy
      const { error: countersCounterError } = await supabase
        .from('strategy_counters')
        .delete()
        .eq('counter_strategy_id', strategyId);

      if (countersCounterError) throw countersCounterError;

      // Delete strategy tags
      const { error: tagsError } = await supabase
        .from('strategy_tags')
        .delete()
        .eq('strategy_id', strategyId);

      if (tagsError) throw tagsError;

      // Finally delete the strategy itself
      const { error: deleteError } = await supabase
        .from('strategies')
        .delete()
        .eq('id', strategyId)
        .eq('user_id', user?.id);

      if (deleteError) throw deleteError;

      // Update local state
      setStrategies(prev => prev.filter(s => s.id !== strategyId));
      setSavedStrategies(prev => prev.filter(s => s.id !== strategyId));
      setSuccess('Strategy removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error removing strategy:', error);
      setError('Failed to remove strategy. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleUnsaveStrategy = async (strategyId: string) => {
    try {
      const { error } = await supabase
        .from('saved_strategies')
        .delete()
        .eq('strategy_id', strategyId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSavedStrategies(prev => prev.filter(s => s.id !== strategyId));
      setSuccess('Strategy removed from saved collection');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error unsaving strategy:', error);
      setError('Failed to remove strategy from saved collection');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-lg text-gray-600">Please log in to view your dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-4 rounded-lg">
          {success}
        </div>
      )}

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Strategies</h2>
          <button
            onClick={() => navigate('/create')}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Create Strategy
          </button>
        </div>

        {strategies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't created any strategies yet.
            </p>
            <button
              onClick={() => navigate('/create')}
              className="btn btn-outline flex items-center gap-2 mx-auto"
            >
              <Plus size={18} />
              Create Your First Strategy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="relative group">
                <StrategyCard strategy={{
                  ...strategy,
                  kits: strategy.kit_ids,
                  winRate: strategy.win_rate,
                  createdAt: new Date(strategy.created_at),
                  updatedAt: new Date(strategy.created_at),
                  createdBy: strategy.user_id,
                  isPublic: strategy.is_public,
                  popularity: 0
                }} />
                <button
                  onClick={() => handleRemoveStrategy(strategy.id)}
                  className="absolute top-2 right-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove strategy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Saved Strategies</h2>
          <button
            onClick={() => navigate('/trending')}
            className="btn btn-outline flex items-center gap-2"
          >
            <Bookmark size={18} />
            Browse Strategies
          </button>
        </div>

        {savedStrategies.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't saved any strategies yet.
            </p>
            <button
              onClick={() => navigate('/trending')}
              className="btn btn-outline flex items-center gap-2 mx-auto"
            >
              <Bookmark size={18} />
              Browse Public Strategies
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedStrategies.map((strategy) => (
              <div key={strategy.id} className="relative group">
                <StrategyCard strategy={{
                  ...strategy,
                  kits: strategy.kit_ids,
                  winRate: strategy.win_rate,
                  createdAt: new Date(strategy.created_at),
                  updatedAt: new Date(strategy.created_at),
                  createdBy: strategy.user_id,
                  isPublic: strategy.is_public,
                  popularity: 0
                }} />
                <button
                  onClick={() => handleUnsaveStrategy(strategy.id)}
                  className="absolute top-2 right-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from saved"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Kits Owned</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPresetModal(true)}
              className="btn btn-outline flex items-center gap-2"
            >
              <Save size={18} />
              Save Account Kits
            </button>
            {presets.length > 0 && (
              <select
                onChange={(e) => {
                  const preset = presets.find(p => p.id === e.target.value);
                  if (preset) loadPreset(preset);
                }}
                className="btn btn-outline"
                defaultValue=""
              >
                <option value="" disabled>Load Account Kits</option>
                {presets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search kits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="space-y-6">
            {sortedKitGroups.map(group => (
              <div key={group.type}>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {group.type}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {group.kits.map(kit => (
                    <div
                      key={kit.id}
                      onClick={() => toggleKitOwnership(kit.id)}
                      className={`cursor-pointer transition-all relative ${
                        ownedKits.includes(kit.id)
                          ? 'ring-2 ring-primary-500'
                          : 'opacity-50'
                      }`}
                    >
                      <KitCard kit={kit} size="sm" />
                      {ownedKits.includes(kit.id) && (
                        <div className="absolute top-1 right-1 bg-primary-500 rounded-full p-1">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Save Account Kits</h3>
              <button
                onClick={() => setShowPresetModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setSaveMode('new')}
                  className={`flex-1 py-2 px-4 rounded-lg ${
                    saveMode === 'new'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  New Account
                </button>
                {presets.length > 0 && (
                  <button
                    onClick={() => setSaveMode('existing')}
                    className={`flex-1 py-2 px-4 rounded-lg ${
                      saveMode === 'existing'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Existing Account
                  </button>
                )}
              </div>

              {saveMode === 'new' ? (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    New Account Name
                  </label>
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Enter account name"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Account
                  </label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Select an account...</option>
                    {presets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPresetModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={savePreset}
                className="btn btn-primary"
              >
                {saveMode === 'new' ? 'Save Account Kits' : 'Update Account Kits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;