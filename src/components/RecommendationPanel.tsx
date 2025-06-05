import React from 'react';
import { useKits } from '../context/KitContext';
import { useBan } from '../context/BanContext';
import KitCard from './KitCard';
import { Strategy } from '../types';
import { AlertCircle, Award, Sparkles } from 'lucide-react';

const RecommendationPanel: React.FC = () => {
  const { 
    selectedStrategyId, 
    strategies, 
    getKitById, 
    getReplacements 
  } = useKits();
  
  const { isBanned } = useBan();
  
  // Get the selected strategy
  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);
  
  // Render the appropriate content based on whether a strategy is selected
  const renderContent = () => {
    if (!selectedStrategy) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <Sparkles size={48} className="mb-4 text-primary-500 dark:text-primary-400" />
          <p className="text-center">
            Select a strategy to see recommendations
          </p>
        </div>
      );
    }
    
    return renderStrategyRecommendations(selectedStrategy);
  };
  
  // Render recommendations for a specific strategy
  const renderStrategyRecommendations = (strategy: Strategy) => {
    // Find any banned kits in this strategy
    const bannedKitsInStrategy = strategy.kits.filter(kitId => isBanned(kitId));
    const hasBannedKits = bannedKitsInStrategy.length > 0;
    
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2">{strategy.name}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {strategy.description}
        </p>
        
        {hasBannedKits ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md mb-4">
            <div className="flex items-start">
              <AlertCircle size={18} className="text-yellow-500 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Adaptation Required
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {bannedKitsInStrategy.length} kit{bannedKitsInStrategy.length > 1 ? 's' : ''} from this strategy {bannedKitsInStrategy.length > 1 ? 'are' : 'is'} banned. Check the recommendations below.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md mb-4">
            <div className="flex items-start">
              <Award size={18} className="text-green-500 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  Strategy Available
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  All kits in this strategy are available for selection.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
          Kit Composition:
        </h4>
        
        <div className="space-y-4">
          {strategy.kits.map(kitId => {
            const kit = getKitById(kitId);
            if (!kit) return null;
            
            const kitIsBanned = isBanned(kitId);
            const replacements = kitIsBanned ? getReplacements(kitId) : null;
            
            return (
              <div key={kitId} className="border rounded-lg p-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className={`flex items-center ${kitIsBanned ? 'opacity-75' : ''}`}>
                  <div className="flex-shrink-0 mr-3">
                    <KitCard kit={kit} size="sm" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {kit.name} 
                      {kitIsBanned && <span className="text-red-600 dark:text-red-400 ml-2">(Banned)</span>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {kit.type.charAt(0).toUpperCase() + kit.type.slice(1)}
                    </p>
                  </div>
                </div>
                
                {kitIsBanned && replacements && (
                  <div className="mt-3 pl-10 border-t border-gray-100 dark:border-gray-700 pt-3">
                    <h5 className="text-xs uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Recommended Replacements:
                    </h5>
                    <div className="flex flex-wrap gap-3">
                      {replacements.replacements.slice(0, 3).map((replacement) => (
                        <div key={replacement.kit.id} className="relative">
                          <KitCard kit={replacement.kit} size="sm" showDetails={false} />
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {replacement.synergy}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Recommendations</h2>
      {renderContent()}
    </div>
  );
};

export default RecommendationPanel;