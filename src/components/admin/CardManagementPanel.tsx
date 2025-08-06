import React, { useState, useEffect } from 'react';
import { CardService } from '../../services/cardService';
import { Card, PackType, BEDWARS_KITS, SEASONS, CLASSES, PACK_TYPES, HOLO_TYPES } from '../../types/cards';
import CardComponent from '../cards/CardComponent';
import { 
  Plus, 
  Save, 
  Eye, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Image, 
  MousePointer,
  Package,
  Coins,
  Settings,
  Users,
  BarChart3
} from 'lucide-react';

interface CardData {
  kit_name: string;
  variant_name?: string;
  season: string;
  class_type: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  is_holo: boolean;
  holo_type: string;
  card_type: 'Kit' | 'Skin';
  pack_type: string;
  image_url?: string;
  background_color: string;
  background_image_url?: string;
  ability_name?: string;
  ability_description?: string;
  flavor_text?: string;
  hp: number;
  weakness?: string;
  resistance: string;
  retreat_cost: number;
  unlock_requirement?: string;
  show_season_overlay: boolean;
  has_border: boolean;
  border_color: string;
  border_behind_holo: boolean;
  has_holo_mask: boolean;
  holo_mask_url?: string;
  card_frame_color: string;
  text_theme: 'dark' | 'light';
}

const CardManagementPanel: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [packTypes, setPackTypes] = useState<PackType[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'cards' | 'packs' | 'stats'>('cards');
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [formData, setFormData] = useState<CardData>({
    kit_name: '',
    variant_name: '',
    season: '',
    class_type: '',
    rarity: 'Common',
    is_holo: false,
    holo_type: 'basic',
    card_type: 'Kit',
    pack_type: '',
    image_url: '',
    background_color: '#5b3434',
    background_image_url: '',
    ability_name: '',
    ability_description: '',
    flavor_text: '',
    hp: 100,
    weakness: '',
    resistance: 'None',
    retreat_cost: 2,
    unlock_requirement: '',
    show_season_overlay: true,
    has_border: true,
    border_color: '#FFD700',
    border_behind_holo: true,
    has_holo_mask: false,
    holo_mask_url: '',
    card_frame_color: '#1f2937',
    text_theme: 'light'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cardsData, packTypesData] = await Promise.all([
        CardService.getAllCards(),
        CardService.getAllPackTypes()
      ]);
      setCards(cardsData);
      setPackTypes(packTypesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleInputChange = (field: keyof CardData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCard = async () => {
    try {
      if (editingCard) {
        await CardService.updateCard(editingCard.id, formData);
      } else {
        await CardService.createCard(formData);
      }
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error saving card:', error);
      alert('Error saving card. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      kit_name: '',
      variant_name: '',
      season: '',
      class_type: '',
      rarity: 'Common',
      is_holo: false,
      holo_type: 'basic',
      card_type: 'Kit',
      pack_type: '',
      image_url: '',
      background_color: '#5b3434',
      background_image_url: '',
      ability_name: '',
      ability_description: '',
      flavor_text: '',
      hp: 100,
      weakness: '',
      resistance: 'None',
      retreat_cost: 2,
      unlock_requirement: '',
      show_season_overlay: true,
      has_border: true,
      border_color: '#FFD700',
      border_behind_holo: true,
      has_holo_mask: false,
      holo_mask_url: '',
      card_frame_color: '#1f2937',
      text_theme: 'light'
    });
    setEditingCard(null);
    setShowBuilder(false);
  };

  const handleEditCard = (card: Card) => {
    setFormData({
      kit_name: card.kit_name,
      variant_name: card.variant_name,
      season: card.season,
      class_type: card.class_type,
      rarity: card.rarity,
      is_holo: card.is_holo,
      holo_type: card.holo_type,
      card_type: card.card_type,
      pack_type: card.pack_type,
      image_url: card.image_url,
      background_color: card.background_color,
      background_image_url: card.background_image_url,
      ability_name: card.ability_name,
      ability_description: card.ability_description,
      flavor_text: card.flavor_text,
      hp: card.hp,
      weakness: card.weakness,
      resistance: card.resistance,
      retreat_cost: card.retreat_cost,
      unlock_requirement: card.unlock_requirement,
      show_season_overlay: card.show_season_overlay,
      has_border: card.has_border,
      border_color: card.border_color,
      border_behind_holo: card.border_behind_holo,
      has_holo_mask: card.has_holo_mask,
      holo_mask_url: card.holo_mask_url,
      card_frame_color: card.card_frame_color,
      text_theme: card.text_theme
    });
    setEditingCard(card);
    setShowBuilder(true);
  };

  const handleDeleteCard = async (cardId: string) => {
    if (confirm('Are you sure you want to delete this card?')) {
      try {
        await CardService.deleteCard(cardId);
        await loadData();
      } catch (error) {
        console.error('Error deleting card:', error);
        alert('Error deleting card. Please try again.');
      }
    }
  };

  const filteredCards = cards.filter(card =>
    card.kit_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (card.variant_name && card.variant_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const exportCards = () => {
    const dataStr = JSON.stringify(cards, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bedwars-cards.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="text-purple-500" />
            Card Management
          </h1>
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('cards')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'cards' 
                  ? 'bg-gray-600 shadow-sm text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setActiveTab('packs')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'packs' 
                  ? 'bg-gray-600 shadow-sm text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Pack Types
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'stats' 
                  ? 'bg-gray-600 shadow-sm text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Statistics
            </button>
          </div>
        </div>
        
        {activeTab === 'cards' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Import Cards
            </button>
            <button
              onClick={() => setShowBuilder(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Create New Card
            </button>
          </div>
        )}
      </div>

      {/* Card Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-auto">
            <div className="flex">
              <div className="flex-1 p-6 space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white">
                    {editingCard ? 'Edit Card' : 'Create New Card'}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded flex items-center gap-1"
                    >
                      <Eye size={16} />
                      {previewMode ? 'Form' : 'Preview'}
                    </button>
                    <button onClick={resetForm} className="text-gray-400 hover:text-white">
                      ✕
                    </button>
                  </div>
                </div>

                {!previewMode ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b border-gray-600 pb-2 text-white">Basic Info</h3>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Kit Name</label>
                        <select
                          value={formData.kit_name}
                          onChange={(e) => handleInputChange('kit_name', e.target.value)}
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                        >
                          <option value="">Select Kit</option>
                          {BEDWARS_KITS.map(kit => (
                            <option key={kit} value={kit}>{kit}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Variant Name</label>
                        <input
                          type="text"
                          value={formData.variant_name}
                          onChange={(e) => handleInputChange('variant_name', e.target.value)}
                          placeholder="e.g., Tiger Brawler"
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Season</label>
                          <select
                            value={formData.season}
                            onChange={(e) => handleInputChange('season', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          >
                            <option value="">Select Season</option>
                            {SEASONS.map(season => (
                              <option key={season} value={season}>{season}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Class</label>
                          <select
                            value={formData.class_type}
                            onChange={(e) => handleInputChange('class_type', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          >
                            <option value="">Select Class</option>
                            {CLASSES.map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <label className="flex items-center text-gray-300">
                          <input
                            type="checkbox"
                            checked={formData.show_season_overlay}
                            onChange={(e) => handleInputChange('show_season_overlay', e.target.checked)}
                            className="mr-2 bg-gray-700 border-gray-600"
                          />
                          <span>Show Season Overlay</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Rarity</label>
                          <select
                            value={formData.rarity}
                            onChange={(e) => {
                              const rarity = e.target.value as CardData['rarity'];
                              handleInputChange('rarity', rarity);
                              if (['Epic', 'Legendary'].includes(rarity) && !formData.is_holo) {
                                handleInputChange('is_holo', true);
                              }
                            }}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          >
                            <option value="Common">Common (55%)</option>
                            <option value="Uncommon">Uncommon (25%)</option>
                            <option value="Rare">Rare (12%)</option>
                            <option value="Epic">Epic (6%)</option>
                            <option value="Legendary">Legendary (1.5%)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Pack Type</label>
                          <select
                            value={formData.pack_type}
                            onChange={(e) => handleInputChange('pack_type', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          >
                            <option value="">Select Pack</option>
                            {PACK_TYPES.map(pack => (
                              <option key={pack} value={pack}>{pack}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <label className="flex items-center text-gray-300">
                          <input
                            type="checkbox"
                            checked={formData.is_holo}
                            onChange={(e) => handleInputChange('is_holo', e.target.checked)}
                            className="mr-2 bg-gray-700 border-gray-600"
                          />
                          <span className="flex items-center gap-1">
                            <Sparkles size={14} className="text-purple-500" />
                            Holo Effect
                          </span>
                        </label>

                        {formData.is_holo && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-300">Holo Type</label>
                              <select
                                value={formData.holo_type}
                                onChange={(e) => handleInputChange('holo_type', e.target.value)}
                                className="text-xs p-1 border border-gray-600 rounded bg-gray-700 text-white"
                              >
                                {HOLO_TYPES.map(type => (
                                  <option key={type.name} value={type.name}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="flex items-center text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={formData.has_holo_mask}
                                  onChange={(e) => handleInputChange('has_holo_mask', e.target.checked)}
                                  className="mr-2 bg-gray-700 border-gray-600"
                                />
                                <span className="text-xs">Use Holo Mask</span>
                              </label>
                            </div>
                            
                            {formData.has_holo_mask && (
                              <div>
                                <label className="block text-xs font-medium mb-1 text-gray-300">Holo Mask URL</label>
                                <input
                                  type="url"
                                  value={formData.holo_mask_url}
                                  onChange={(e) => handleInputChange('holo_mask_url', e.target.value)}
                                  placeholder="https://... (mask image URL)"
                                  className="w-full text-xs p-1 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg border-b border-gray-600 pb-2 text-white">Visual & Stats</h3>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Image URL</label>
                        <input
                          type="url"
                          value={formData.image_url}
                          onChange={(e) => handleInputChange('image_url', e.target.value)}
                          placeholder="https://..."
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Background Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.background_color}
                            onChange={(e) => handleInputChange('background_color', e.target.value)}
                            className="w-12 h-10 border border-gray-600 rounded bg-gray-700"
                          />
                          <input
                            type="text"
                            value={formData.background_color}
                            onChange={(e) => handleInputChange('background_color', e.target.value)}
                            className="flex-1 p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Background Image URL (Optional)</label>
                        <input
                          type="url"
                          value={formData.background_image_url}
                          onChange={(e) => handleInputChange('background_image_url', e.target.value)}
                          placeholder="https://... (appears behind main image)"
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">HP</label>
                          <input
                            type="number"
                            value={formData.hp}
                            onChange={(e) => handleInputChange('hp', parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                            min="10"
                            max="200"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Weakness</label>
                          <input
                            type="text"
                            value={formData.weakness}
                            onChange={(e) => handleInputChange('weakness', e.target.value)}
                            placeholder="Light"
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Retreat Cost</label>
                          <input
                            type="number"
                            value={formData.retreat_cost}
                            onChange={(e) => handleInputChange('retreat_cost', parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                            min="0"
                            max="5"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Ability Name</label>
                        <input
                          type="text"
                          value={formData.ability_name}
                          onChange={(e) => handleInputChange('ability_name', e.target.value)}
                          placeholder="Dark Decay"
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Ability Description</label>
                        <textarea
                          value={formData.ability_description}
                          onChange={(e) => handleInputChange('ability_description', e.target.value)}
                          placeholder="Describe the kit's special ability..."
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400 h-20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-300">Flavor Text</label>
                        <input
                          type="text"
                          value={formData.flavor_text}
                          onChange={(e) => handleInputChange('flavor_text', e.target.value)}
                          placeholder="The decaying shadow who always finds her mark."
                          className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Card Frame Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={formData.card_frame_color}
                              onChange={(e) => handleInputChange('card_frame_color', e.target.value)}
                              className="w-12 h-10 border border-gray-600 rounded bg-gray-700"
                            />
                            <input
                              type="text"
                              value={formData.card_frame_color}
                              onChange={(e) => handleInputChange('card_frame_color', e.target.value)}
                              className="flex-1 p-2 border border-gray-600 rounded bg-gray-700 text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-300">Text Theme</label>
                          <select
                            value={formData.text_theme}
                            onChange={(e) => handleInputChange('text_theme', e.target.value)}
                            className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                          >
                            <option value="light">Light Text</option>
                            <option value="dark">Dark Text</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <label className="flex items-center text-gray-300">
                          <input
                            type="checkbox"
                            checked={formData.has_border}
                            onChange={(e) => handleInputChange('has_border', e.target.checked)}
                            className="mr-2 bg-gray-700 border-gray-600"
                          />
                          <span>Show Card Border</span>
                        </label>

                        {formData.has_border && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-300">Border Color</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={formData.border_color}
                                  onChange={(e) => handleInputChange('border_color', e.target.value)}
                                  className="w-12 h-10 border border-gray-600 rounded bg-gray-700"
                                />
                                <input
                                  type="text"
                                  value={formData.border_color}
                                  onChange={(e) => handleInputChange('border_color', e.target.value)}
                                  className="flex-1 p-2 border border-gray-600 rounded bg-gray-700 text-white"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="flex items-center text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={formData.border_behind_holo}
                                  onChange={(e) => handleInputChange('border_behind_holo', e.target.checked)}
                                  className="mr-2 bg-gray-700 border-gray-600"
                                />
                                <span className="text-sm">Border Behind Holo</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <CardComponent card={formData as Card} interactive={true} />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700 text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCard}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    <Save size={16} />
                    {editingCard ? 'Update Card' : 'Create Card'}
                  </button>
                </div>
              </div>

              {!previewMode && (
                <div className="w-80 bg-gray-700 p-4 border-l border-gray-600">
                  <h3 className="font-semibold mb-4 flex items-center gap-2 text-white">
                    <MousePointer size={16} />
                    Live Preview
                  </h3>
                  <div className="flex justify-center">
                    <div style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
                      <CardComponent card={formData as Card} interactive={true} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cards Tab */}
      {activeTab === 'cards' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Created Cards ({cards.length})</h2>
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredCards.map(card => (
              <div key={card.id} className="relative group">
                <div style={{ transform: 'scale(0.6)', transformOrigin: 'top center' }}>
                  <CardComponent card={card} interactive={true} />
                </div>
                
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditCard(card)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-bold">{card.kit_name}</p>
                  {card.variant_name && <p className="italic">{card.variant_name}</p>}
                  <p>{card.rarity} • {card.season}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredCards.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              {cards.length === 0 
                ? "No cards created yet. Click 'Create New Card' to get started!"
                : "No cards match your search term."
              }
            </div>
          )}
        </div>
      )}

      {/* Pack Types Tab */}
      {activeTab === 'packs' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Pack Types ({packTypes.length})</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packTypes.map(pack => (
              <div key={pack.id} className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{pack.name}</h3>
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold text-white">{pack.price}</span>
                  </div>
                </div>
                
                <p className="text-gray-300 text-sm mb-4">{pack.description}</p>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-300">Cards per pack: {pack.card_count}</div>
                  <div className="text-sm text-gray-400">Rarity distribution:</div>
                  {Object.entries(pack.rarity_weights).map(([rarity, weight]) => (
                    <div key={rarity} className="flex justify-between text-xs text-gray-300">
                      <span>{rarity}</span>
                      <span>{weight}%</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <span className={`inline-block px-2 py-1 rounded text-xs ${
                    pack.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                  }`}>
                    {pack.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Card System Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{cards.length}</div>
                  <div className="text-sm text-gray-300">Total Cards</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
              <div className="flex items-center gap-3">
                <Coins className="w-8 h-8 text-yellow-500" />
                <div>
                  <div className="text-2xl font-bold text-white">{packTypes.length}</div>
                  <div className="text-sm text-gray-300">Pack Types</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
              <div className="flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {cards.filter(card => card.is_holo).length}
                  </div>
                  <div className="text-sm text-gray-300">Holo Cards</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {cards.filter(card => card.rarity === 'Legendary').length}
                  </div>
                  <div className="text-sm text-gray-300">Legendary Cards</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-4 text-white">Rarity Distribution</h3>
            <div className="grid grid-cols-5 gap-4">
              {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(rarity => (
                <div key={rarity} className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {cards.filter(card => card.rarity === rarity).length}
                  </div>
                  <div className="text-sm text-gray-300">{rarity}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-600">
        <h3 className="text-lg font-semibold mb-4 text-white">Card Data Management</h3>
        <div className="flex gap-4">
          <button
            onClick={exportCards}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
            disabled={cards.length === 0}
          >
            Export Cards
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardManagementPanel; 