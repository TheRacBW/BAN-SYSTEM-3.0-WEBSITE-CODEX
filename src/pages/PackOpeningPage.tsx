import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CardService } from '../services/cardService';
import { Card, PackType, UserCoins, UserInventory, UserGoal } from '../types/cards';
import CardComponent from '../components/cards/CardComponent';
import { 
  Coins, 
  Package, 
  Trophy, 
  Clock, 
  Users, 
  Settings, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import './PackOpeningPage.css';

const PackOpeningPage: React.FC = () => {
  const { user } = useAuth();
  const [packTypes, setPackTypes] = useState<PackType[]>([]);
  const [userCoins, setUserCoins] = useState<UserCoins | null>(null);
  const [userInventory, setUserInventory] = useState<UserInventory[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [openingPack, setOpeningPack] = useState(false);
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [showOpenedCards, setShowOpenedCards] = useState(false);
  const [activeTab, setActiveTab] = useState<'packs' | 'inventory' | 'goals' | 'stats'>('packs');
  const [selectedPack, setSelectedPack] = useState<PackType | null>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
      startSession();
    }
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive) {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      const [packTypesData, coinsData, inventoryData, goalsData] = await Promise.all([
        CardService.getAllPackTypes(),
        CardService.getUserCoins(user.id),
        CardService.getUserInventory(user.id),
        CardService.getUserGoals(user.id)
      ]);

      setPackTypes(packTypesData);
      setUserCoins(coinsData);
      setUserInventory(inventoryData);
      setUserGoals(goalsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const startSession = async () => {
    if (!user) return;
    
    try {
      const session = await CardService.startSession(user.id);
      setSessionId(session.id);
      setSessionActive(true);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    
    try {
      await CardService.endSession(sessionId);
      setSessionActive(false);
      setSessionTime(0);
      setSessionId(null);
      await loadData(); // Refresh coins
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const openPack = async (packType: PackType) => {
    if (!user || openingPack) return;
    
    setOpeningPack(true);
    setSelectedPack(packType);
    
    try {
      const result = await CardService.openPack(user.id, packType.id);
      setOpenedCards(result.cards_obtained);
      setShowOpenedCards(true);
      
      // Refresh data
      await loadData();
      
      // Auto-hide opened cards after 5 seconds
      setTimeout(() => {
        setShowOpenedCards(false);
        setOpenedCards([]);
        setSelectedPack(null);
      }, 5000);
      
    } catch (error) {
      console.error('Error opening pack:', error);
      alert('Error opening pack. Please try again.');
    } finally {
      setOpeningPack(false);
    }
  };

  const equipCard = async (cardId: string) => {
    if (!user) return;
    
    try {
      await CardService.equipCard(user.id, cardId);
      await loadData(); // Refresh inventory
    } catch (error) {
      console.error('Error equipping card:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getGoalProgress = (goal: UserGoal) => {
    const progress = (goal.current_value / goal.target_value) * 100;
    return Math.min(progress, 100);
  };

  const getGoalIcon = (goalType: string) => {
    switch (goalType) {
      case 'daily_time':
        return <Clock className="w-4 h-4" />;
      case 'packs_opened':
        return <Package className="w-4 h-4" />;
      case 'cards_collected':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Trophy className="w-4 h-4" />;
    }
  };

  const getGoalLabel = (goalType: string) => {
    switch (goalType) {
      case 'daily_time':
        return 'Time on Website';
      case 'packs_opened':
        return 'Packs Opened';
      case 'cards_collected':
        return 'Cards Collected';
      default:
        return goalType;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please log in to access the card system</h2>
          <p className="text-gray-600">You need to be logged in to open packs and collect cards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-2 rounded-lg">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-bold">{userCoins?.coins || 0}</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400">{formatTime(sessionTime)}</span>
                {sessionActive ? (
                  <Play className="w-3 h-3 text-green-400" />
                ) : (
                  <Pause className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={endSession}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
            <div className="flex">
              <button
                onClick={() => setActiveTab('packs')}
                className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'packs' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" />
                Open Packs
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'inventory' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4" />
                Inventory
              </button>
              <button
                onClick={() => setActiveTab('goals')}
                className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'goals' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Trophy className="w-4 h-4" />
                Goals
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'stats' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                Stats
              </button>
            </div>
          </div>
        </div>

        {/* Pack Opening Tab */}
        {activeTab === 'packs' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-4">Card Pack Opening</h1>
              <p className="text-gray-300">Open packs to collect rare BedWars cards!</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packTypes.map((pack) => (
                <div key={pack.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-white mb-2">{pack.name}</h3>
                    <p className="text-gray-300 text-sm mb-4">{pack.description}</p>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{pack.price}</span>
                    </div>
                    <div className="text-gray-300 text-sm">
                      {pack.card_count} cards per pack
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-xs text-gray-400">Rarity Distribution:</div>
                    {Object.entries(pack.rarity_weights).map(([rarity, weight]) => (
                      <div key={rarity} className="flex justify-between text-xs">
                        <span className="text-gray-300">{rarity}</span>
                        <span className="text-gray-400">{weight}%</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => openPack(pack)}
                    disabled={openingPack || (userCoins?.coins || 0) < pack.price}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                      (userCoins?.coins || 0) >= pack.price
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {openingPack && selectedPack?.id === pack.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        Opening...
                      </div>
                    ) : (
                      'Open Pack'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Your Card Collection</h2>
              <p className="text-gray-300">Manage your collected cards and equip them as profile pictures</p>
            </div>

            {userInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No cards yet</h3>
                <p className="text-gray-400">Open some packs to start your collection!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {userInventory.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="transform scale-75 origin-top">
                      <CardComponent 
                        card={item.card!} 
                        interactive={true}
                        onClick={() => equipCard(item.card_id)}
                      />
                    </div>
                    
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      x{item.quantity}
                    </div>
                    
                    {item.is_equipped && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                        Equipped
                      </div>
                    )}
                    
                    <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="font-bold">{item.card?.kit_name}</p>
                      <p className="text-gray-300">{item.card?.rarity}</p>
                      {!item.is_equipped && (
                        <button
                          onClick={() => equipCard(item.card_id)}
                          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Equip
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'goals' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Daily Goals</h2>
              <p className="text-gray-300">Complete goals to earn extra coins</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userGoals.map((goal) => (
                <div key={goal.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center gap-3 mb-4">
                    {getGoalIcon(goal.goal_type)}
                    <div>
                      <h3 className="text-lg font-semibold text-white">{getGoalLabel(goal.goal_type)}</h3>
                      <p className="text-gray-300 text-sm">
                        {goal.current_value} / {goal.target_value}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${getGoalProgress(goal)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-semibold">{goal.reward_coins}</span>
                    </div>
                    {goal.is_completed && (
                      <div className="text-green-400 text-sm font-semibold">Completed!</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Your Statistics</h2>
              <p className="text-gray-300">Track your progress and achievements</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <Coins className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{userCoins?.total_earned || 0}</div>
                <div className="text-gray-300 text-sm">Total Coins Earned</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{userInventory.length}</div>
                <div className="text-gray-300 text-sm">Unique Cards</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <Package className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">
                  {userInventory.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
                <div className="text-gray-300 text-sm">Total Cards</div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center">
                <Clock className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{formatTime(sessionTime)}</div>
                <div className="text-gray-300 text-sm">Session Time</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Opened Cards Modal */}
      {showOpenedCards && openedCards.length > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-4xl w-full">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Cards Opened!</h3>
              <p className="text-gray-300">You got {openedCards.length} new cards</p>
            </div>

            <div className="flex justify-center gap-4 overflow-x-auto">
              {openedCards.map((card, index) => (
                <div key={index} className="flex-shrink-0">
                  <CardComponent card={card} interactive={true} scale={0.8} />
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => setShowOpenedCards(false)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackOpeningPage; 