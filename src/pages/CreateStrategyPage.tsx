import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useKits } from '../context/KitContext';
import { Plus, X, Check, Search } from 'lucide-react';
import KitCard from '../components/KitCard';
import { supabase } from '../lib/supabase';
import { useKitReload } from '../hooks/useKitReload';

const CreateStrategyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasKits, loading: kitsLoading } = useKitReload();
  const { 
    kits,
    selectedKits,
    addKitToStrategy,
    removeKitFromStrategy,
    clearSelectedKits,
    getKitById,
    strategies,
    getSortedKits
  } = useKits();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredKits = kits.filter(kit => 
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedKitGroups = getSortedKits(filteredKits);

  const checkForDuplicateStrategy = () => {
    const sortedSelectedKits = [...selectedKits].sort();
    
    const duplicate = strategies.find(strategy => {
      const sortedStrategyKits = [...strategy.kits].sort();
      return JSON.stringify(sortedStrategyKits) === JSON.stringify(sortedSelectedKits);
    });

    return duplicate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a strategy');
      return;
    }

    if (selectedKits.length !== 5) {
      setError('Please select exactly 5 kits for your strategy');
      return;
    }

    if (!name.trim()) {
      setError('Please enter a strategy name');
      return;
    }

    const duplicate = checkForDuplicateStrategy();
    if (duplicate) {
      setDuplicateStrategy(duplicate);
      setShowDuplicateModal(true);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim(),
          kit_ids: selectedKits,
          is_public: isPublic,
          effectiveness: 50,
          counterability: 50,
          win_rate: 0.5,
          popularity: 0
        })
        .select()
        .single();

      if (strategyError) throw strategyError;

      setSuccess(`Strategy "${name}" has been successfully ${isPublic ? 'published' : 'saved'}!`);
      
      setName('');
      setDescription('');
      setIsPublic(false);
      clearSelectedKits();
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Error creating strategy:', err);
      setError('Failed to create strategy. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDuplicate = () => {
    navigate('/trending', { 
      state: { 
        searchQuery: duplicateStrategy.name 
      } 
    });
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Please sign in to create strategies
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="btn btn-primary"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (kitsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasKits) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Game Data</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch the latest kit information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Create New Strategy</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center">
            <X className="mr-2" size={18} />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex items-center">
            <Check className="mr-2" size={18} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Strategy Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 h-32"
              placeholder="Describe your strategy, its strengths, and how to execute it effectively..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
              Selected Kits ({selectedKits.length}/5)
            </label>
            <div className="flex flex-wrap gap-3 mb-4 min-h-[100px] p-4 border-2 border-dashed rounded-lg border-gray-300 dark:border-gray-600">
              {selectedKits.map((kitId, index) => {
                const kit = getKitById(kitId);
                if (!kit) return null;
                
                return (
                  <div key={`${kitId}-${index}`} className="relative">
                    <KitCard kit={kit} size="sm" />
                    <button
                      type="button"
                      onClick={() => removeKitFromStrategy(kitId, index)}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              {selectedKits.length === 0 && (
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  Select kits from below to build your strategy
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Available Kits
            </label>
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
            <div className="max-h-[400px] overflow-y-auto pr-2">
              <div className="space-y-6">
                {sortedKitGroups.map(group => (
                  <div key={group.type}>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {group.type}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {group.kits.map(kit => (
                        <div
                          key={kit.id}
                          onClick={() => {
                            if (selectedKits.length < 5) {
                              addKitToStrategy(kit.id);
                            }
                          }}
                          className={`cursor-pointer transition-all ${
                            selectedKits.length >= 5 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:scale-105'
                          }`}
                        >
                          <KitCard kit={kit} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:border-gray-600 dark:bg-gray-700"
            />
            <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700 dark:text-gray-200">
              Make this strategy public
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!user || selectedKits.length !== 5 || !name.trim() || isSubmitting}
              className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:hover:bg-primary-600 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Strategy...
                </div>
              ) : (
                <>
                  <Plus size={20} />
                  Create Strategy
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {showDuplicateModal && duplicateStrategy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Similar Strategy Found</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              A strategy with the same kit combination already exists:
              "{duplicateStrategy.name}"
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleViewDuplicate}
                className="btn btn-primary flex items-center gap-2"
              >
                <Search size={18} />
                View Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateStrategyPage;