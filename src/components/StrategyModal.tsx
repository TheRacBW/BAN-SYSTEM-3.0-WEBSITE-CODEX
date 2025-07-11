import React, { useState, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck, Edit2, Save, Trash2, MessageSquare, Heart, HeartOff, CheckCircle2 } from 'lucide-react';
import { Strategy } from '../types';
import { useAuth } from '../context/AuthContext';
import { useKits } from '../context/KitContext';
import { supabase } from '../lib/supabase';
import KitCard from './KitCard';
import StarRating from './StarRating';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  likes: number;
  username?: string;
  isLiked?: boolean;
}

interface StrategyModalProps {
  strategy: Strategy;
  onClose: () => void;
}

const StrategyModal: React.FC<StrategyModalProps> = ({ strategy, onClose }) => {
  const { user, isAdmin } = useAuth();
  const { getKitById } = useKits();
  const [isSaved, setIsSaved] = useState(false);
  const [userRating, setUserRating] = useState<{ effectiveness: number; counterability: number }>({ 
    effectiveness: 2.5, 
    counterability: 2.5 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(strategy.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [weeklyEncounters, setWeeklyEncounters] = useState(0);
  const [hasEncounteredThisWeek, setHasEncounteredThisWeek] = useState(false);

  useEffect(() => {
    if (user) {
      checkSavedStatus();
      fetchUserRating();
      fetchComments();
      fetchEncounters();
    }
  }, [user, strategy.id]);

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diff = now.getUTCDate() - dayOfWeek;
    const weekStart = new Date(now.setUTCDate(diff));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0];
  };

  const fetchEncounters = async () => {
    try {
      const weekStart = getWeekStart();

      const { count: totalCount } = await supabase
        .from('strategy_encounters')
        .select('*', { count: 'exact', head: true })
        .eq('strategy_id', strategy.id)
        .eq('week_start', weekStart);

      setWeeklyEncounters(totalCount || 0);

      if (user) {
        const { data: userEncounter } = await supabase
          .from('strategy_encounters')
          .select('*')
          .eq('strategy_id', strategy.id)
          .eq('user_id', user.id)
          .eq('week_start', weekStart)
          .maybeSingle();

        setHasEncounteredThisWeek(!!userEncounter);
      }
    } catch (error) {
      console.error('Error fetching encounters:', error);
    }
  };

  const handleEncounterToggle = async () => {
    if (!user) return;

    try {
      const weekStart = getWeekStart();

      if (hasEncounteredThisWeek) {
        const { error } = await supabase
          .from('strategy_encounters')
          .delete()
          .eq('strategy_id', strategy.id)
          .eq('user_id', user.id)
          .eq('week_start', weekStart);

        if (error) throw error;

        setWeeklyEncounters(prev => prev - 1);
        setHasEncounteredThisWeek(false);
      } else {
        const { error } = await supabase
          .from('strategy_encounters')
          .insert({
            strategy_id: strategy.id,
            user_id: user.id,
            week_start: weekStart
          });

        if (error) throw error;

        setWeeklyEncounters(prev => prev + 1);
        setHasEncounteredThisWeek(true);
      }
    } catch (error) {
      console.error('Error toggling encounter:', error);
      setError('Failed to update encounter status');
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
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

      if (error) {
        console.error('Error checking saved status:', error);
        return;
      }

      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const fetchUserRating = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strategy_ratings')
        .select('effectiveness, counterability')
        .eq('user_id', user.id)
        .eq('strategy_id', strategy.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user rating:', error);
        return;
      }

      if (data) {
        setUserRating({
          effectiveness: data.effectiveness / 20,
          counterability: data.counterability / 20
        });
      }
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('strategy_comments')
        .select(`
          id,
          content,
          user_id,
          created_at,
          likes,
          users:user_id (username)
        `)
        .eq('strategy_id', strategy.id)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      const { data: userLikes, error: likesError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user?.id);

      if (likesError) throw likesError;

      const likedCommentIds = new Set(userLikes?.map(like => like.comment_id));

      const formattedComments = commentsData?.map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        created_at: comment.created_at,
        likes: comment.likes,
        username: comment.users?.username || 'Anonymous',
        isLiked: likedCommentIds.has(comment.id)
      })) || [];

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('strategy_comments')
        .insert({
          strategy_id: strategy.id,
          user_id: user.id,
          content: newComment.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setComments([{
        id: data.id,
        content: data.content,
        user_id: data.user_id,
        created_at: data.created_at,
        likes: 0,
        username: user.email?.split('@')[0] || 'Anonymous',
        isLiked: false
      }, ...comments]);

      setNewComment('');
      setSuccess('Comment posted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.id
          });

        if (error) throw error;
      }

      setComments(comments.map(comment => 
        comment.id === commentId
          ? {
              ...comment,
              likes: comment.likes + (isLiked ? -1 : 1),
              isLiked: !isLiked
            }
          : comment
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('strategy_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      setComments(comments.filter(comment => comment.id !== commentId));
      setSuccess('Comment deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      setError(null);

      const { data: existingStrategy, error: selectError } = await supabase
        .from('strategies')
        .select('id')
        .eq('id', strategy.id)
        .single();

      if (selectError || !existingStrategy) {
        setError('This strategy no longer exists');
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
      setSuccess(isSaved ? 'Strategy removed from saved collection' : 'Strategy saved to your collection');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error toggling save status:', error);
      setError('Failed to save strategy');
    }
  };

  const handleRating = async (type: 'effectiveness' | 'counterability', value: number) => {
    if (!user) {
      setError('Please sign in to rate strategies');
      return;
    }

    try {
      setError(null);
      const newRating = {
        ...userRating,
        [type]: value
      };

      const dbRating = {
        effectiveness: Math.round(newRating.effectiveness * 20),
        counterability: Math.round(newRating.counterability * 20)
      };

      const { data: existingRating, error: checkError } = await supabase
        .from('strategy_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('strategy_id', strategy.id)
        .maybeSingle();

      if (checkError) throw checkError;

      let ratingError;

      if (existingRating) {
        const { error: updateError } = await supabase
          .from('strategy_ratings')
          .update(dbRating)
          .eq('id', existingRating.id);
        
        ratingError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('strategy_ratings')
          .insert({
            user_id: user.id,
            strategy_id: strategy.id,
            ...dbRating
          });
        
        ratingError = insertError;
      }

      if (ratingError) throw ratingError;

      setUserRating(newRating);
      setSuccess('Rating updated successfully');
      setTimeout(() => setSuccess(null), 1500);
    } catch (error) {
      console.error('Error updating rating:', error);
      setError('Failed to update rating. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);
      setSuccess(null);

      const { error: ratingsError } = await supabase
        .from('strategy_ratings')
        .delete()
        .eq('strategy_id', strategy.id);

      if (ratingsError) {
        throw new Error('Failed to delete strategy ratings');
      }

      const { error: savedError } = await supabase
        .from('saved_strategies')
        .delete()
        .eq('strategy_id', strategy.id);

      if (savedError) {
        throw new Error('Failed to delete saved strategies');
      }

      const { error: countersBaseError } = await supabase
        .from('strategy_counters')
        .delete()
        .eq('base_strategy_id', strategy.id);

      if (countersBaseError) {
        throw new Error('Failed to delete base counter strategies');
      }

      const { error: countersCounterError } = await supabase
        .from('strategy_counters')
        .delete()
        .eq('counter_strategy_id', strategy.id);

      if (countersCounterError) {
        throw new Error('Failed to delete counter strategies');
      }

      const { error: tagsError } = await supabase
        .from('strategy_tags')
        .delete()
        .eq('strategy_id', strategy.id);

      if (tagsError) {
        throw new Error('Failed to delete strategy tags');
      }

      const { error: deleteError } = await supabase
        .from('strategies')
        .delete()
        .eq('id', strategy.id);

      if (deleteError) {
        throw new Error('Failed to delete strategy');
      }

      setSuccess('Strategy deleted successfully');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error deleting strategy:', error);
      setError(error.message || 'Failed to delete strategy');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateName = async () => {
    if (!isAdmin || !editedName.trim()) return;

    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('strategies')
        .update({ name: editedName.trim() })
        .eq('id', strategy.id);

      if (updateError) throw updateError;

      setSuccess('Strategy name updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error updating strategy name:', error);
      setError('Failed to update strategy name');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-900 dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 relative"
        onClick={handleModalClick}
      >
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{strategy.name}</h2>
              <div className="text-sm text-gray-400">by {strategy.createdBy || 'Unknown'}</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Kit Composition */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Kit Composition</h3>
            <div className="flex flex-wrap gap-3">
              {strategy.kits.map(kitId => {
                const kit = getKitById(kitId);
                if (!kit) return null;
                return <KitCard key={kitId} kit={kit} size="md" />;
              })}
            </div>
          </div>

          {/* Encounters */}
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={handleEncounterToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                ${hasEncounteredThisWeek ? 'bg-green-700 text-green-200' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              title={hasEncounteredThisWeek ? 'Remove encounter' : 'Mark as encountered this week'}
            >
              <CheckCircle2 size={20} />
              {hasEncounteredThisWeek ? 'Encountered' : 'Did you face this strat this week?'}
            </button>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900 text-blue-300 text-xs font-semibold">
              {weeklyEncounters} {weeklyEncounters === 1 ? 'player' : 'players'} faced this week
            </span>
          </div>

          {/* Ratings */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Rate This Strategy</h3>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="mb-2 text-gray-300 font-medium">Effectiveness</div>
                  <StarRating
                    value={userRating.effectiveness}
                    onChange={(value) => handleRating('effectiveness', value)}
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-2 text-gray-300 font-medium">Counterability</div>
                  <StarRating
                    value={userRating.counterability}
                    onChange={(value) => handleRating('counterability', value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <MessageSquare size={20} />
              Comments ({comments.length})
            </h3>
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
              {comments.map((comment: any) => (
                <div key={comment.id} className="bg-gray-800 rounded-lg p-3 flex flex-col gap-1 border border-gray-700">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-blue-400 font-semibold">{comment.username || 'Anonymous'}</span>
                    <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-200 text-sm">{comment.content}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => handleLikeComment(comment.id, !!comment.isLiked)}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors
                        ${comment.isLiked ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400 hover:bg-blue-800 hover:text-blue-200'}`}
                    >
                      <Heart size={14} /> {comment.likes}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {user && (
              <div className="mt-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts about this strategy..."
                  className="w-full p-3 border rounded-lg dark:border-gray-600 dark:bg-gray-700 min-h-[80px] text-gray-200"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="mt-2 btn btn-primary rounded-full px-6 py-2 text-sm font-semibold"
                >
                  {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-900/40 text-red-300 rounded mt-4 text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-900/40 text-green-300 rounded mt-4 text-center">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyModal;