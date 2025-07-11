import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Flame, PlusCircle, Clock, List, FileText } from 'lucide-react';
import BanSimulator from '../components/BanSimulator';
import StrategyBrowser from '../components/StrategyBrowser';
import RecommendationPanel from '../components/RecommendationPanel';
import { useAuth } from '../context/AuthContext';
import { useKits } from '../context/KitContext';
import KitCard from '../components/KitCard';
import { Plus, X, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useKitReload } from '../hooks/useKitReload';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { id: 'banaware', label: 'Ban-Aware Kit Recommendations', icon: <Lightbulb size={20} /> },
  { id: 'trending', label: 'Trending Strategies', icon: <Flame size={20} /> },
  { id: 'create', label: 'Create New Strategy', icon: <PlusCircle size={20} /> },
];

const StratPickerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('banaware');
  // HomePage logic for Ban-Aware Kit Recommendations
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasKits, loading } = useKitReload();

  // CreateStrategyPage logic for Create New Strategy tab
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

  // For Create New Strategy tab: add a step/tab system for the form
  const CREATE_TABS = [
    { id: 'kits', label: 'Select Kits', icon: <List size={18} /> },
    { id: 'details', label: 'Details', icon: <FileText size={18} /> },
    { id: 'review', label: 'Review', icon: <Clock size={18} /> },
  ];
  const [createTab, setCreateTab] = useState<'kits' | 'details' | 'review'>('kits');

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

  let tabContent: React.ReactNode;
  if (activeTab === 'banaware') {
    if (loading) {
      tabContent = (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    } else if (!user) {
      tabContent = (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <h2 className="text-2xl font-semibold mb-4">Welcome to TheRac's Kit Ban Planner</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please sign in to access the Ban Planner and Strategy Browser
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="btn btn-primary"
          >
            Sign In
          </button>
        </div>
      );
    } else if (!hasKits) {
      tabContent = (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading Game Data</h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch the latest kit information...</p>
          </div>
        </div>
      );
    } else {
      tabContent = (
        <>
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            Ban-Aware Kit Combination Recommendations
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <BanSimulator />
            </div>
            <div className="lg:col-span-1">
              <StrategyBrowser />
            </div>
            <div className="lg:col-span-1">
              <RecommendationPanel />
            </div>
          </div>
        </>
      );
    }
  } else if (activeTab === 'trending') {
    tabContent = (
      <div className="py-4">
        <StrategyBrowser />
      </div>
    );
  } else if (activeTab === 'create') {
    if (!user) {
      tabContent = (
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
    } else if (loading) {
      tabContent = (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    } else if (!hasKits) {
      tabContent = (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading Game Data</h2>
            <p className="text-gray-600 dark:text-gray-400">Please wait while we fetch the latest kit information...</p>
          </div>
        </div>
      );
    } else {
      tabContent = (
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Create New Strategy</h1>
          {/* Step/Tab System for Create Strategy */}
          <div className="mb-8">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              {CREATE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCreateTab(tab.id as typeof createTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    createTab === tab.id
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            {/* Tabbed form content */}
            {createTab === 'kits' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Select 5 Kits for Your Strategy
                </label>
                {/* Kit selection UI placeholder (replace with actual kit selection logic) */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {kits.slice(0, 10).map((kit) => (
                    <div key={kit.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{kit.name}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-primary mt-2"
                  onClick={() => setCreateTab('details')}
                  disabled={selectedKits.length !== 5}
                >
                  Next: Details
                </button>
                {selectedKits.length !== 5 && (
                  <div className="text-xs text-red-500 mt-2">Please select exactly 5 kits.</div>
                )}
              </div>
            )}
            {createTab === 'details' && (
              <form onSubmit={(e) => { e.preventDefault(); setCreateTab('review'); }} className="space-y-6">
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
                    className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="accent-blue-600 rounded"
                      checked={isPublic}
                      onChange={() => setIsPublic(!isPublic)}
                    />
                    Make Public
                  </label>
                </div>
                <div className="flex justify-between mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setCreateTab('kits')}>Back</button>
                  <button type="submit" className="btn btn-primary">Next: Review</button>
                </div>
              </form>
            )}
            {createTab === 'review' && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Review Your Strategy</h3>
                <div className="mb-4">
                  <div className="font-medium text-gray-700 dark:text-gray-200">Name: <span className="font-normal">{name}</span></div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">Description: <span className="font-normal">{description}</span></div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">Kits: <span className="font-normal">{selectedKits.join(', ')}</span></div>
                  <div className="font-medium text-gray-700 dark:text-gray-200">Visibility: <span className="font-normal">{isPublic ? 'Public' : 'Private'}</span></div>
                </div>
                <div className="flex justify-between mt-6">
                  <button type="button" className="btn btn-secondary" onClick={() => setCreateTab('details')}>Back</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Create Strategy'}
                  </button>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center">
                    <X className="mr-2" size={18} />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex items-center">
                    <Check className="mr-2" size={18} />
                    {success}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full bg-[#232B39] dark:bg-gray-800 border-b border-gray-200/10 dark:border-gray-700/40 px-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-8 py-6 w-full">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-wide mb-1" style={{ letterSpacing: '0.01em' }}>
            Strat Picker
          </h1>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Tab Content with Animation */}
        <div className="space-y-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="w-full"
            >
              {tabContent}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default StratPickerPage; 