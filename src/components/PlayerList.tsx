import React from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import PlayerCard from './PlayerCard';
import { usePlayerStore } from '../store/playerStore';
import { useAuth } from '../context/AuthContext';

export function PlayerList() {
  const { players, loading, error, refreshPlayer, refreshAllPlayers } = usePlayerStore();
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = React.useState(false);

  const handleRefreshAll = async () => {
    await refreshAllPlayers();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Players</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh All
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Player
          </button>
        </div>
      </div>

      {loading && <div>Loading players...</div>}
      {error && <div className="text-red-500">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            onDelete={isAdmin ? undefined : undefined} // implement as needed
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {/* ... rest of the component ... */}
    </div>
  );
} 