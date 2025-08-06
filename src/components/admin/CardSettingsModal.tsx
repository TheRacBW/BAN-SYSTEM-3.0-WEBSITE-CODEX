import React, { useState, useEffect } from 'react';
import { CardService } from '../../services/cardService';
import { SeasonConfig, PackTypeConfig, CardRarity } from '../../types/cards';
import { 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  Image as ImageIcon,
  Package,
  Coins,
  Settings
} from 'lucide-react';

interface CardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CardSettingsModal: React.FC<CardSettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'seasons' | 'packTypes'>('seasons');
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [packTypes, setPackTypes] = useState<PackTypeConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Season form state
  const [seasonForm, setSeasonForm] = useState({
    name: '',
    image_url: '',
    is_active: true
  });
  const [editingSeason, setEditingSeason] = useState<SeasonConfig | null>(null);

  // Pack type form state
  const [packForm, setPackForm] = useState({
    name: '',
    description: '',
    price: 100,
    card_count: 5,
    rarity_weights: {
      Common: 50,
      Uncommon: 30,
      Rare: 15,
      Epic: 4,
      Legendary: 1
    } as Record<CardRarity, number>,
    is_active: true
  });
  const [editingPack, setEditingPack] = useState<PackTypeConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [seasonsData, packTypesData] = await Promise.all([
        CardService.getAllSeasons(),
        CardService.getAllPackTypeConfigs()
      ]);
      setSeasons(seasonsData);
      setPackTypes(packTypesData);
    } catch (err) {
      setError('Failed to load settings data');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Season management functions
  const handleSeasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingSeason) {
        await CardService.updateSeason(editingSeason.id, seasonForm);
      } else {
        await CardService.createSeason(seasonForm);
      }
      
      await loadData();
      resetSeasonForm();
    } catch (err) {
      setError('Failed to save season');
      console.error('Error saving season:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSeason = (season: SeasonConfig) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      image_url: season.image_url,
      is_active: season.is_active
    });
  };

  const handleDeleteSeason = async (id: string) => {
    if (!confirm('Are you sure you want to delete this season?')) return;
    
    setLoading(true);
    setError(null);
    try {
      await CardService.deleteSeason(id);
      await loadData();
    } catch (err) {
      setError('Failed to delete season');
      console.error('Error deleting season:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetSeasonForm = () => {
    setSeasonForm({
      name: '',
      image_url: '',
      is_active: true
    });
    setEditingSeason(null);
  };

  // Pack type management functions
  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingPack) {
        await CardService.updatePackTypeConfig(editingPack.id, packForm);
      } else {
        await CardService.createPackTypeConfig(packForm);
      }
      
      await loadData();
      resetPackForm();
    } catch (err) {
      setError('Failed to save pack type');
      console.error('Error saving pack type:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPack = (pack: PackTypeConfig) => {
    setEditingPack(pack);
    setPackForm({
      name: pack.name,
      description: pack.description,
      price: pack.price,
      card_count: pack.card_count,
      rarity_weights: pack.rarity_weights,
      is_active: pack.is_active
    });
  };

  const handleDeletePack = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pack type?')) return;
    
    setLoading(true);
    setError(null);
    try {
      await CardService.deletePackTypeConfig(id);
      await loadData();
    } catch (err) {
      setError('Failed to delete pack type');
      console.error('Error deleting pack type:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPackForm = () => {
    setPackForm({
      name: '',
      description: '',
      price: 100,
      card_count: 5,
      rarity_weights: {
        Common: 50,
        Uncommon: 30,
        Rare: 15,
        Epic: 4,
        Legendary: 1
      },
      is_active: true
    });
    setEditingPack(null);
  };

  const handleRarityWeightChange = (rarity: CardRarity, value: number) => {
    setPackForm(prev => ({
      ...prev,
      rarity_weights: {
        ...prev.rarity_weights,
        [rarity]: value
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Card System Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('seasons')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'seasons'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4" />
              <span>Seasons</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('packTypes')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'packTypes'
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Pack Types</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-200">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          )}

          {activeTab === 'seasons' && (
            <div className="space-y-6">
              {/* Season Form */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {editingSeason ? 'Edit Season' : 'Add New Season'}
                </h3>
                <form onSubmit={handleSeasonSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Season Name
                      </label>
                      <input
                        type="text"
                        value={seasonForm.name}
                        onChange={(e) => setSeasonForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Season 1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Image URL
                      </label>
                      <input
                        type="url"
                        value={seasonForm.image_url}
                        onChange={(e) => setSeasonForm(prev => ({ ...prev, image_url: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/image.png"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="season-active"
                      checked={seasonForm.is_active}
                      onChange={(e) => setSeasonForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="season-active" className="text-sm text-gray-300">
                      Active
                    </label>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingSeason ? 'Update' : 'Create'}</span>
                    </button>
                    {editingSeason && (
                      <button
                        type="button"
                        onClick={resetSeasonForm}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Seasons List */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Existing Seasons</h3>
                <div className="space-y-3">
                  {seasons.map((season) => (
                    <div key={season.id} className="flex items-center justify-between p-3 bg-gray-600 rounded">
                      <div className="flex items-center space-x-3">
                        <img
                          src={season.image_url}
                          alt={season.name}
                          className="w-8 h-8 rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32x32/666/fff?text=?';
                          }}
                        />
                        <div>
                          <div className="text-white font-medium">{season.name}</div>
                          <div className="text-sm text-gray-400">{season.image_url}</div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          season.is_active 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-500 text-gray-300'
                        }`}>
                          {season.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSeason(season)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-500 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSeason(season.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-500 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'packTypes' && (
            <div className="space-y-6">
              {/* Pack Type Form */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {editingPack ? 'Edit Pack Type' : 'Add New Pack Type'}
                </h3>
                <form onSubmit={handlePackSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Pack Name
                      </label>
                      <input
                        type="text"
                        value={packForm.name}
                        onChange={(e) => setPackForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Season Pack"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={packForm.description}
                        onChange={(e) => setPackForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Pack description"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Price (Coins)
                      </label>
                      <input
                        type="number"
                        value={packForm.price}
                        onChange={(e) => setPackForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Cards per Pack
                      </label>
                      <input
                        type="number"
                        value={packForm.card_count}
                        onChange={(e) => setPackForm(prev => ({ ...prev, card_count: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  {/* Rarity Weights */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rarity Weights (%)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as CardRarity[]).map((rarity) => (
                        <div key={rarity}>
                          <label className="block text-xs text-gray-400 mb-1">{rarity}</label>
                          <input
                            type="number"
                            value={packForm.rarity_weights[rarity]}
                            onChange={(e) => handleRarityWeightChange(rarity, parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max="100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="pack-active"
                      checked={packForm.is_active}
                      onChange={(e) => setPackForm(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="pack-active" className="text-sm text-gray-300">
                      Active
                    </label>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingPack ? 'Update' : 'Create'}</span>
                    </button>
                    {editingPack && (
                      <button
                        type="button"
                        onClick={resetPackForm}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Pack Types List */}
              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Existing Pack Types</h3>
                <div className="space-y-3">
                  {packTypes.map((pack) => (
                    <div key={pack.id} className="flex items-center justify-between p-3 bg-gray-600 rounded">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <Package className="w-5 h-5 text-blue-400" />
                          <div>
                            <div className="text-white font-medium">{pack.name}</div>
                            <div className="text-sm text-gray-400">{pack.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <Coins className="w-4 h-4 text-yellow-400" />
                            <span className="text-gray-300">{pack.price}</span>
                          </div>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-300">{pack.card_count} cards</span>
                          <span className="text-gray-400">•</span>
                          <span className={`px-2 py-1 text-xs rounded ${
                            pack.is_active 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-500 text-gray-300'
                          }`}>
                            {pack.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditPack(pack)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-500 rounded"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePack(pack.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-500 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardSettingsModal; 