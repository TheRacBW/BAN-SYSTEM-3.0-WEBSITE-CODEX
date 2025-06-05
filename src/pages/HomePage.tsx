import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BanSimulator from '../components/BanSimulator';
import StrategyBrowser from '../components/StrategyBrowser';
import RecommendationPanel from '../components/RecommendationPanel';
import { useKitReload } from '../hooks/useKitReload';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasKits, loading } = useKitReload();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
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
};

export default HomePage;