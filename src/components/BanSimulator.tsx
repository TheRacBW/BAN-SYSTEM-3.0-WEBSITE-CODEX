import React, { useState } from 'react';
import { Ban, RefreshCw, ArrowLeftRight, Vote, MousePointer2, Search } from 'lucide-react';
import { useBan, MAX_BANS_PER_TEAM } from '../context/BanContext';
import { useKits } from '../context/KitContext';
import KitCard from './KitCard';

const BanSimulator: React.FC = () => {
  const { 
    bans, 
    currentTeam, 
    addBan, 
    removeBan, 
    switchTeam, 
    switchTeamVoting,
    resetBans, 
    isBanned,
    yourTeam 
  } = useBan();
  
  const { kits, selectKit, selectedKitId, loading, getSortedKits } = useKits();
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleKitClick = (kitId: string) => {
    if (selectedKitId === kitId) {
      selectKit(null);
      return;
    }
    
    if (isBanned(kitId)) {
      removeBan(kitId);
      selectKit(null);
      return;
    }
    
    selectKit(kitId);
    addBan(kitId);
  };

  const filteredKits = kits.filter(kit => 
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedKitGroups = getSortedKits(filteredKits);

  const renderBanSlots = (team: 'teamA' | 'teamB') => {
    const slots = [];
    const isYourTeam = team === yourTeam;
    const teamColor = team === 'teamA' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20';
    const teamTextColor = team === 'teamA' ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300';
    const borderColor = team === 'teamA' ? 'border-blue-200 dark:border-blue-800' : 'border-orange-200 dark:border-orange-800';
    const teamName = team === 'teamA' ? 'Blue Team' : 'Orange Team';
    
    for (let i = 0; i < MAX_BANS_PER_TEAM; i++) {
      const kitId = bans[team][i];
      const kit = kitId ? kits.find(k => k.id === kitId) : null;
      
      slots.push(
        <div 
          key={`${team}-${i}`} 
          className={`border-2 rounded-lg w-16 h-16 flex items-center justify-center
            ${team === currentTeam && bans[team].length === i 
              ? 'border-dashed animate-pulse-slow ' + borderColor
              : 'border-gray-200 dark:border-gray-700'}`}
        >
          {kit ? (
            <img 
              src={kit.imageUrl} 
              alt={kit.name} 
              className="w-14 h-14 object-cover rounded opacity-75 cursor-pointer hover:opacity-100"
              onClick={() => removeBan(kit.id)}
            />
          ) : (
            <Ban size={24} className="text-gray-300 dark:text-gray-600" />
          )}
        </div>
      );
    }
    
    return (
      <div className={`p-4 rounded-lg ${teamColor}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={`text-sm font-medium ${teamTextColor}`}>
            {teamName} {isYourTeam && '(Your Team)'}
          </h3>
          {team === currentTeam && (
            <div className={`flex items-center ${teamTextColor}`}>
              <MousePointer2 size={14} className="mr-1" />
              <span className="text-xs font-medium">Selecting</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {slots}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="panel">
        <h2 className="panel-title">Ban Simulator</h2>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="flex justify-between items-center mb-4">
        <h2 className="panel-title">Ban Simulator</h2>
        <button 
          onClick={resetBans}
          className="text-sm flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <RefreshCw size={14} className="mr-1" />
          Reset
        </button>
      </div>
      
      <div className="space-y-4 mb-6">
        {renderBanSlots(yourTeam)}
        {renderBanSlots(yourTeam === 'teamA' ? 'teamB' : 'teamA')}
      </div>
      
      <div className="flex justify-center gap-4 mb-4">
        <button 
          onClick={switchTeamVoting}
          className="text-sm btn btn-outline flex items-center gap-2"
        >
          <Vote size={16} />
          Switch Team Voting
        </button>
        
        <button 
          onClick={switchTeam}
          className="text-sm btn btn-outline flex items-center gap-2"
        >
          <ArrowLeftRight size={16} />
          Switch Teams
        </button>
      </div>
      
      <div>
        <h3 className="text-sm font-medium mb-3">Select Kits to Ban:</h3>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {group.kits.map(kit => (
                    <KitCard 
                      key={kit.id} 
                      kit={kit} 
                      onClick={() => handleKitClick(kit.id)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BanSimulator;