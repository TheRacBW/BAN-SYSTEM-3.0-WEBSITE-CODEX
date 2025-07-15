import React, { useState } from 'react';
import { Player } from '../../types/players';
import { X, Users, Shield, Image, Maximize2, Trash2, Loader2 } from 'lucide-react';
import KitCard from '../KitCard';
import RobloxStatus from '../RobloxStatus';
import { useKits } from '../../context/KitContext';
import { supabase } from '../../lib/supabase';

// --- Roblox Profile Integration ---
interface RobloxProfile {
  user_id: number;
  profile_picture_url: string;
  cached_at: string;
  username: string;
}

const useRobloxProfiles = (playerAccounts: any[]) => {
  const [profiles, setProfiles] = React.useState<Map<string, RobloxProfile>>(new Map());
  const [loading, setLoading] = React.useState(false);

  const fetchRobloxProfiles = async () => {
    if (!playerAccounts?.length) return;
    setLoading(true);
    try {
      const usernames = playerAccounts.map(acc => acc.username);
      const { data: existingCache } = await supabase
        .from('roblox_user_cache')
        .select('username, user_id, profile_picture_url, cached_at')
        .in('username', usernames);
      const cacheMap = new Map();
      existingCache?.forEach(profile => {
        cacheMap.set(profile.username, profile);
      });
      const missingUsernames = usernames.filter(username => !cacheMap.has(username));
      if (missingUsernames.length > 0) {
        await Promise.all(
          missingUsernames.map(username =>
            supabase
              .from('roblox_user_cache')
              .upsert({ username }, { onConflict: 'username' })
          )
        );
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: updatedCache } = await supabase
          .from('roblox_user_cache')
          .select('username, user_id, profile_picture_url, cached_at')
          .in('username', missingUsernames);
        updatedCache?.forEach(profile => {
          cacheMap.set(profile.username, profile);
        });
      }
      setProfiles(cacheMap);
    } catch (error) {
      console.error('Error fetching Roblox profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRobloxProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(playerAccounts)]);

  return { profiles, loading, refetch: fetchRobloxProfiles };
};

interface RobloxProfilePictureProps {
  username: string;
  profile?: RobloxProfile;
  size?: 'sm' | 'md' | 'lg';
  showLink?: boolean;
}

const RobloxProfilePicture: React.FC<RobloxProfilePictureProps> = ({
  username,
  profile,
  size = 'md',
  showLink = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  const ProfileImage = () => (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>
      {profile?.profile_picture_url ? (
        <img
          src={profile.profile_picture_url}
          alt={`${username}'s Roblox avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://www.roblox.com/headshot-thumbnail/image?userId=${profile.user_id}&width=150&height=150&format=png`;
          }}
        />
      ) : (
        <div className="text-gray-400 text-xs font-mono">
          {username.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
  if (showLink && profile?.user_id) {
    return (
      <a
        href={`https://www.roblox.com/users/${profile.user_id}/profile`}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:opacity-80 transition-opacity"
        title={`View ${username}'s Roblox profile`}
      >
        <ProfileImage />
      </a>
    );
  }
  return <ProfileImage />;
};

const KnownAccountsSection = ({ accounts, isAdmin, onDeleteAccount }: { accounts: any[], isAdmin?: boolean, onDeleteAccount?: (id: string) => void }) => {
  const { profiles, loading } = useRobloxProfiles(accounts);
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
        Accounts ({accounts.length})
      </h4>
      {loading && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading profiles...
        </div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {accounts.map((account) => {
          const profile = profiles.get(account.username);
          // Rank badge
          const rankBadge = account.rank && Array.isArray(account.rank) && account.rank.length > 0 ? account.rank[0].account_ranks : null;
          // BedWars badge
          const inBedwars = account.status?.inBedwars;
          return (
            <div
              key={account.id}
              className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <RobloxProfilePicture
                username={account.username}
                profile={profile}
                size="sm"
                showLink={true}
              />
              <div className="flex-1 min-w-0">
                <a
                  href={profile?.user_id ? `https://www.roblox.com/users/${profile.user_id}/profile` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm truncate hover:underline text-blue-700 dark:text-blue-300"
                  title={`View ${account.username}'s Roblox profile`}
                >
                  {account.username}
                </a>
                <div className="flex items-center gap-2 mt-1">
                  {/* Online status */}
                  {account.status?.isOnline ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs" title="Online">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400 text-xs" title="Offline">
                      <span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span>Offline
                    </span>
                  )}
                  {/* Rank badge */}
                  {rankBadge && (
                    <img
                      src={rankBadge.image_url}
                      alt={rankBadge.name}
                      className="w-5 h-5 ml-1"
                      title={rankBadge.name}
                    />
                  )}
                  {/* BedWars badge */}
                  {inBedwars && (
                    <img
                      src="https://cdn2.steamgriddb.com/icon/3ad9ecf4b4a26b7671e09283f001d626.png"
                      alt="BedWars"
                      className="w-5 h-5 ml-1"
                      title="In BedWars"
                    />
                  )}
                </div>
              </div>
              {isAdmin && onDeleteAccount && (
                <button
                  onClick={() => onDeleteAccount(account.id)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Delete Account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
// --- End Roblox Profile Integration ---

interface PlayerModalProps {
  player: Player;
  onClose: () => void;
  onShowRankClaim: () => void;
  onShowTeammates: () => void;
  onDeleteStrategy: (id: string) => void;
  isAdmin?: boolean;
}

export default function PlayerModal({ 
  player, 
  onClose, 
  onShowRankClaim,
  onShowTeammates,
  onDeleteStrategy,
  isAdmin 
}: PlayerModalProps) {
  const { kits } = useKits();
  const [showStrategyImages, setShowStrategyImages] = useState(true);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">{player.alias}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Users size={18} className="text-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {player.teammates?.length || 0} Teammates
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold mb-4">Known Accounts</h3>
            <KnownAccountsSection accounts={player.accounts || []} isAdmin={isAdmin} />
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Teammates</h3>
              <button
                onClick={onShowTeammates}
                className="btn btn-outline flex items-center gap-2"
              >
                <Users size={18} />
                Manage Teammates
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.teammates?.map(teammate => (
                <div key={teammate.teammate.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <span>{teammate.teammate.alias}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Strategies</h3>
              <button
                onClick={() => setShowStrategyImages(!showStrategyImages)}
                className="btn btn-outline flex items-center gap-2"
              >
                <Image size={18} />
                {showStrategyImages ? 'Hide Images' : 'Show Images'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.strategies?.map(strategy => (
                <div key={strategy.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  {showStrategyImages && (
                    <div className="relative mb-4">
                      <img
                        src={strategy.image_url}
                        alt="Strategy"
                        className="w-full h-32 object-cover rounded cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setExpandedStrategyId(strategy.id)}
                      />
                      <button
                        className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75"
                        onClick={() => setExpandedStrategyId(strategy.id)}
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {strategy.kit_ids.map(kitId => {
                      const kit = kits.find(k => k.id === kitId);
                      if (!kit) return null;
                      return (
                        <div key={kitId} className="w-8 h-8">
                          <KitCard kit={kit} size="sm" showDetails={false} />
                        </div>
                      );
                    })}
                  </div>

                  {isAdmin && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => onDeleteStrategy(strategy.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-center">
            <button
              onClick={onShowRankClaim}
              className="btn btn-primary flex items-center gap-2"
            >
              <Shield size={18} />
              Submit Rank Update
            </button>
          </div>
        </div>

        {expandedStrategyId && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]">
            <div className="relative max-w-4xl w-full mx-4">
              <button
                onClick={() => setExpandedStrategyId(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300"
              >
                <X size={24} />
              </button>
              <img
                src={player.strategies?.find(s => s.id === expandedStrategyId)?.image_url}
                alt="Strategy"
                className="w-full h-auto rounded"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}