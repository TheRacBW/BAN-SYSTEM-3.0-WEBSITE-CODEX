import React, { useState, useEffect } from 'react';
import { Strategy, StrategyTag, StrategyTagColors } from '../types';
import { TrendingUp, Award, Users, Shield, Swords, Bookmark, BookmarkCheck, Edit2, Trash2, ToggleLeft, ToggleRight, Plus, Globe, Lock, MessageSquare, CheckCircle2 } from 'lucide-react';
import KitCard from './KitCard';
import { useKits } from '../context/KitContext';
import { useBan } from '../context/BanContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface StrategyCardProps {
  strategy: Strategy;
  onClick?: () => void;
  isSelected?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  showTags?: boolean;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ 
  strategy, 
  onClick, 
  isSelected = false,
  onDelete,
  onEdit,
  showTags = true
}) => {
  const { getKitById } = useKits();
  const { isBanned } = useBan();
  const { user, isAdmin } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<boolean | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>('Unknown');
  const [isActive, setIsActive] = useState(strategy.isActive ?? true);
  const [tags, setTags] = useState<StrategyTag[]>(strategy.tags ?? []);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState<StrategyTag | ''>('');
  const [isPublic, setIsPublic] = useState(strategy.isPublic);
  const [commentCount, setCommentCount] = useState(0);
  const [weeklyEncounters, setWeeklyEncounters] = useState(0);

  const availableTags: StrategyTag[] = ['Rush', 'Late', 'Eco', 'Troll'];
  
  useEffect(() => {
    if (user) {
      checkSavedStatus();
      fetchStrategyTags();
      fetchCommentCount();
      fetchWeeklyEncounters();

      // Subscribe to comment changes
      const commentsSubscription = supabase
        .channel('comments_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'strategy_comments',
            filter: `strategy_id=eq.${strategy.id}`
          }, 
          () => {
            fetchCommentCount();
          }
        )
        .subscribe();

      // Subscribe to encounters changes
      const encountersSubscription = supabase
        .channel('encounters_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'strategy_encounters',
            filter: `strategy_id=eq.${strategy.id}`
          }, 
          () => {
            fetchWeeklyEncounters();
          }
        )
        .subscribe();

      return () => {
        commentsSubscription.unsubscribe();
        encountersSubscription.unsubscribe();
      };
    }
    fetchCreatorName();
  }, [user, strategy.id]);

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diff = now.getUTCDate() - dayOfWeek;
    const weekStart = new Date(now.setUTCDate(diff));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0];
  };

  const fetchWeeklyEncounters = async () => {
    try {
      const weekStart = getWeekStart();
      const { count } = await supabase
        .from('strategy_encounters')
        .select('*', { count: 'exact', head: true })
        .eq('strategy_id', strategy.id)
        .eq('week_start', weekStart);

      setWeeklyEncounters(count || 0);
    } catch (error) {
      console.error('Error fetching weekly encounters:', error);
    }
  };

  const fetchCommentCount = async () => {
    try {
      const { count } = await supabase
        .from('strategy_comments')
        .select('*', { count: 'exact', head: true })
        .eq('strategy_id', strategy.id);

      setCommentCount(count || 0);
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

  const fetchCreatorName = async () => {
    if (!strategy.user_id) {
      setCreatorName('Unknown');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', strategy.user_id)
        .maybeSingle();

      if (error) throw error;
      setCreatorName(data?.username ?? 'Unknown');
    } catch (error) {
      console.error('Error fetching creator name:', error);
      setCreatorName('Unknown');
    }
  };

  const checkSavedStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_strategies')
        .select('*')
        .eq('user_id', user.id)
        .eq('strategy_id', strategy.id)
        .maybeSingle();

      if (error) throw error;
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking saved status:', error);
      setIsSaved(false);
    }
  };

  const fetchStrategyTags = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strategy_tags')
        .select('*')
        .eq('user_id', user.id)
        .eq('strategy_id', strategy.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTags(data.tags || []);
        setIsActive(data.is_active);
      }
    } catch (error) {
      console.error('Error fetching strategy tags:', error);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      setError(undefined);
      setErrorMessage('');

      const { data: existingStrategy, error: selectError } = await supabase
        .from('strategies')
        .select('id')
        .eq('id', strategy.id)
        .single();

      if (selectError || !existingStrategy) {
        setError(true);
        setErrorMessage('This strategy no longer exists');
        return;
      }

      if (isSaved) {
        const { error: deleteError } = await supabase
          .from('saved_strategies')
          .delete()
          .eq('user_id', user.id)
          .eq('strategy_id', strategy.id);

        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('saved_strategies')
          .insert({
            user_id: user.id,
            strategy_id: strategy.id
          });

        if (insertError) throw insertError;
      }
      
      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Error toggling save status:', error);
      setError(true);
      setErrorMessage('Failed to save strategy');
    }
  };

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const newActiveState = !isActive;
      const { error } = await supabase
        .from('strategy_tags')
        .upsert({
          user_id: user.id,
          strategy_id: strategy.id,
          is_active: newActiveState,
          tags: tags
        });

      if (error) throw error;
      setIsActive(newActiveState);
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const handleTogglePublic = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    try {
      const newPublicState = !isPublic;
      const { error } = await supabase
        .from('strategies')
        .update({ is_public: newPublicState })
        .eq('id', strategy.id);

      if (error) throw error;
      setIsPublic(newPublicState);
    } catch (error) {
      console.error('Error toggling public status:', error);
    }
  };

  const handleAddTag = async (tag: StrategyTag) => {
    if (!user || tags.includes(tag)) return;

    try {
      const newTags = [...tags, tag];
      const { error } = await supabase
        .from('strategy_tags')
        .upsert({
          user_id: user.id,
          strategy_id: strategy.id,
          tags: newTags,
          is_active: isActive
        });

      if (error) throw error;
      setTags(newTags);
      setNewTag('');
      setShowTagInput(false);
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const handleRemoveTag = async (tagToRemove: StrategyTag) => {
    if (!user) return;

    try {
      const newTags = tags.filter(tag => tag !== tagToRemove);
      const { error } = await supabase
        .from('strategy_tags')
        .upsert({
          user_id: user.id,
          strategy_id: strategy.id,
          tags: newTags,
          is_active: isActive
        });

      if (error) throw error;
      setTags(newTags);
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };
  
  const kits = strategy.kits ?? [];
  const hasBannedKits = kits.some(kitId => isBanned(kitId));
  const bannedKitsCount = kits.filter(kitId => isBanned(kitId)).length;
  
  const borderClass = isSelected 
    ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-300 dark:ring-primary-700 shadow-lg shadow-primary-500/20 dark:shadow-primary-400/20' 
    : hasBannedKits 
      ? 'border-red-300 dark:border-red-800' 
      : 'border-gray-200 dark:border-gray-700';

  return (
    <div 
      className={`combo-card ${borderClass} ${hasBannedKits ? 'opacity-75' : ''} relative transition-all duration-200 ease-in-out hover:shadow-lg hover:shadow-primary-500/10 dark:hover:shadow-primary-400/10 hover:scale-[1.01] hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {strategy.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            by {creatorName}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (onEdit) onEdit(strategy.id);
                }}
                className="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                title="Edit strategy"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (onDelete) onDelete(strategy.id);
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                title="Delete strategy"
              >
                <Trash2 size={18} />
              </button>
              <button
                onClick={handleTogglePublic}
                className={`${
                  isPublic
                    ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                title={isPublic ? 'Make private' : 'Make public'}
              >
                {isPublic ? <Globe size={18} /> : <Lock size={18} />}
              </button>
            </div>
          )}
          {user && (
            <button
              onClick={handleSave}
              className={`text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 ${
                error ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={error}
              title={errorMessage || (isSaved ? 'Remove from saved' : 'Save strategy')}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center text-green-600 dark:text-green-400" title="Win Rate">
              <TrendingUp size={14} className="mr-1" />
              {Math.round((strategy.winRate ?? 0) * 100)}%
            </span>
            <span className="flex items-center text-purple-600 dark:text-purple-400" title="Popularity">
              <Users size={14} className="mr-1" />
              {strategy.popularity ?? 0}
            </span>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        {strategy.description}
      </p>
      
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center text-blue-600 dark:text-blue-400" title="How well did this combo perform?">
            <Swords size={14} className="mr-1" />
            {strategy.effectiveness ?? 0}%
          </span>
          <span className="flex items-center text-amber-600 dark:text-amber-400" title="How tough is it to play against?">
            <Shield size={14} className="mr-1" />
            {strategy.counterability ?? 0}%
          </span>
          <span className="flex items-center text-purple-600 dark:text-purple-400" title="Number of comments">
            <MessageSquare size={14} className="mr-1" />
            {commentCount}
          </span>
          <span className="flex items-center text-green-600 dark:text-green-400" title="Players encountered this week">
            <CheckCircle2 size={14} className="mr-1" />
            {weeklyEncounters}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(strategy.createdAt).toLocaleDateString()}
        </span>
      </div>

      {showTags && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map(tag => (
            <span
              key={tag}
              className={`px-2 py-1 rounded-full text-xs font-medium ${StrategyTagColors[tag]} cursor-pointer hover:opacity-75`}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              title="Click to remove tag"
            >
              {tag}
            </span>
          ))}
          {tags.length < availableTags.length && (
            showTagInput ? (
              <div className="relative" onClick={e => e.stopPropagation()}>
                <select
                  value={newTag}
                  onChange={e => handleAddTag(e.target.value as StrategyTag)}
                  className="appearance-none px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 cursor-pointer"
                  onBlur={() => setShowTagInput(false)}
                  autoFocus
                >
                  <option value="">Select a tag...</option>
                  {availableTags.filter(tag => !tags.includes(tag)).map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagInput(true);
                }}
                className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center gap-1"
              >
                <Plus size={12} />
                Add Tag
              </button>
            )
          )}
        </div>
      )}
      
      {hasBannedKits && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-xs p-2 rounded mb-3 flex items-center">
          <Award size={14} className="mr-1" />
          {bannedKitsCount} banned kit{bannedKitsCount > 1 ? 's' : ''} in this strategy
        </div>
      )}

      {error && errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-xs p-2 rounded mb-3">
          {errorMessage}
        </div>
      )}
      
      <div className="flex gap-2 overflow-x-auto pb-2">
        {kits.map(kitId => {
          const kit = getKitById(kitId);
          if (!kit) return null;
          
          return (
            <div key={kitId} className="flex-shrink-0">
              <KitCard kit={kit} size="sm" showDetails={false} />
            </div>
          );
        })}
      </div>

      {user && showTags && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Active Strategy
          </span>
          <button
            onClick={handleToggleActive}
            className={`transition-colors ${
              isActive 
                ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300' 
                : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
            }`}
            title={isActive ? 'Mark as inactive' : 'Mark as active'}
          >
            {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default StrategyCard;