import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneCall, 
  X, 
  AlertTriangle, 
  Shield, 
  User, 
  Users, 
  Image, 
  Send,
  Clock,
  CheckCircle,
  Loader,
  Eye,
  FileText,
  Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface AdminCallFormData {
  callerUsername: string;
  suspectUsername: string;
  reasonCategory: string;
  reasonDescription: string;
  proofImageUrl: string;
}

const AdminCallButton: React.FC = () => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canMakeCall, setCanMakeCall] = useState(false);
  const [activeAdminCount, setActiveAdminCount] = useState(1);
  const [recentCallTime, setRecentCallTime] = useState<Date | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const [formData, setFormData] = useState<AdminCallFormData>({
    callerUsername: '',
    suspectUsername: '',
    reasonCategory: 'hacking',
    reasonDescription: '',
    proofImageUrl: ''
  });

  const reasonOptions = [
    { value: 'hacking', label: 'Hacking/Cheating' },
    { value: 'exploiting', label: 'Exploiting' },
    { value: 'griefing', label: 'Griefing' },
    { value: 'toxicity', label: 'Toxic Behavior' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (user) {
      checkCallEligibility();
      fetchActiveAdminCount();
      
      // Set up real-time subscription for admin count
      const adminCountSubscription = supabase
        .channel('admin_availability_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'admin_availability' },
          fetchActiveAdminCount
        )
        .subscribe();

      return () => {
        adminCountSubscription.unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    // Cooldown timer
    if (recentCallTime && cooldownRemaining > 0) {
      const timer = setInterval(() => {
        const now = new Date();
        const timeDiff = Math.max(0, 120 - Math.floor((now.getTime() - recentCallTime.getTime()) / 1000));
        setCooldownRemaining(timeDiff);
        
        if (timeDiff === 0) {
          setRecentCallTime(null);
          checkCallEligibility();
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [recentCallTime, cooldownRemaining]);

  useEffect(() => {
    // Clear messages after 5 seconds
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const checkCallEligibility = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('can_user_make_admin_call', {
        user_uuid: user.id
      });

      if (error) throw error;
      setCanMakeCall(data);

      // Check recent call time
      const { data: restrictions } = await supabase
        .from('user_call_restrictions')
        .select('last_call_at')
        .eq('user_id', user.id)
        .single();

      if (restrictions?.last_call_at) {
        const lastCall = new Date(restrictions.last_call_at);
        const now = new Date();
        const timeDiff = Math.floor((now.getTime() - lastCall.getTime()) / 1000);
        
        if (timeDiff < 120) { // 2 minutes cooldown
          setRecentCallTime(lastCall);
          setCooldownRemaining(120 - timeDiff);
        }
      }
    } catch (err) {
      console.error('Error checking call eligibility:', err);
    }
  };

  const fetchActiveAdminCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_active_admin_count');
      if (!error && data) {
        setActiveAdminCount(data);
      }
    } catch (err) {
      console.error('Error fetching admin count:', err);
    }
  };

  const validateForm = () => {
    if (!formData.callerUsername.trim()) {
      setError('Your Roblox username is required');
      return false;
    }

    if (!formData.suspectUsername.trim()) {
      setError('Suspected cheater username is required');
      return false;
    }

    if (formData.callerUsername.trim().toLowerCase() === formData.suspectUsername.trim().toLowerCase()) {
      setError('You cannot report yourself');
      return false;
    }

    if (!formData.reasonDescription.trim()) {
      setError('Please describe what the player is doing');
      return false;
    }

    return true;
  };

  const submitCall = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch suspect user ID using the edge function
      let suspectUserId = null;
      let suspectAvatarUrl = null;

      try {
        const { data: suspectData, error: suspectError } = await supabase.functions.invoke('fetch-roblox-user', {
          body: { 
            username: formData.suspectUsername.trim(),
            includeDetails: false
          }
        });

        if (!suspectError && suspectData?.success) {
          suspectUserId = suspectData.user.userId;
          suspectAvatarUrl = suspectData.user.avatarUrl;
        }
      } catch (fetchError) {
        console.warn('Failed to fetch suspect user data:', fetchError);
        // Continue without user ID - not critical
      }

      // Submit the admin call
      const { error } = await supabase
        .from('admin_call_alerts')
        .insert({
          submitted_by: user?.id,
          discord_username: user?.email?.split('@')[0] || 'Unknown',
          caller_roblox_username: formData.callerUsername.trim(),
          suspect_roblox_username: formData.suspectUsername.trim(),
          suspect_user_id: suspectUserId,
          suspect_avatar_url: suspectAvatarUrl,
          reason_category: formData.reasonCategory,
          reason_description: formData.reasonDescription.trim(),
          proof_image_url: formData.proofImageUrl.trim() || null
        });

      if (error) throw error;

      setSuccess(`Admin call submitted! ${activeAdminCount} admin${activeAdminCount > 1 ? 's' : ''} notified. Your call will expire in 5 minutes.`);
      
      // Reset form
      setFormData({
        callerUsername: '',
        suspectUsername: '',
        reasonCategory: 'hacking',
        reasonDescription: '',
        proofImageUrl: ''
      });
      
      setIsExpanded(false);
      
      // Update call eligibility
      checkCallEligibility();
      
    } catch (err) {
      console.error('Error submitting admin call:', err);
      setError('Failed to submit admin call. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't show if user is not authenticated
  if (!user) return null;

  // Format cooldown time
  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isOnCooldown = cooldownRemaining > 0;
  const isDisabled = !canMakeCall || isOnCooldown;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Admin Count Badge */}
          <div className="absolute -top-2 -left-2 bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {activeAdminCount}
          </div>
          
          {/* Status Indicator */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          
          {/* Main Button */}
          <button
            onClick={() => !isDisabled && setIsExpanded(!isExpanded)}
            disabled={isDisabled}
            className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center ${
              isDisabled 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-red-500 hover:bg-red-600 hover:scale-110 cursor-pointer'
            }`}
          >
            {isOnCooldown ? (
              <Clock className="text-white" size={24} />
            ) : (
              <Phone className="text-white" size={24} />
            )}
          </button>
        </div>
      </div>

      {/* Modal Overlay */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <Phone className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Call Admin</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {activeAdminCount} admin{activeAdminCount > 1 ? 's' : ''} available
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={18} />
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  Emergency Use Only
                </p>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Only call admins for immediate assistance with active cheaters/hackers in your game.
              </p>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Caller Username */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <User size={16} />
                  Your Roblox Username
                </label>
                <input
                  type="text"
                  value={formData.callerUsername}
                  onChange={(e) => setFormData({ ...formData, callerUsername: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Enter your Roblox username"
                  required
                />
              </div>

              {/* Suspect Username */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Suspected Cheater Username
                </label>
                <input
                  type="text"
                  value={formData.suspectUsername}
                  onChange={(e) => setFormData({ ...formData, suspectUsername: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Enter the cheater's username"
                  required
                />
              </div>

              {/* Violation Type */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield size={16} />
                  Violation Type
                </label>
                <select
                  value={formData.reasonCategory}
                  onChange={(e) => setFormData({ ...formData, reasonCategory: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  {reasonOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  Description
                </label>
                <textarea
                  value={formData.reasonDescription}
                  onChange={(e) => setFormData({ ...formData, reasonDescription: e.target.value })}
                  rows={3}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Describe what the player is doing..."
                  required
                />
              </div>

              {/* Proof Image URL */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Camera size={16} />
                  Proof Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.proofImageUrl}
                  onChange={(e) => setFormData({ ...formData, proofImageUrl: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="https://example.com/screenshot.png"
                />
                {formData.proofImageUrl && (
                  <div className="mt-2">
                    <img
                      src={formData.proofImageUrl}
                      alt="Proof"
                      className="max-w-full h-32 object-cover rounded border"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Expiry Notice */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="text-blue-600 dark:text-blue-400" size={16} />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your call will automatically expire in 5 minutes
                  </p>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-100 dark:bg-green-900/30 border border-green-400 text-green-700 dark:text-green-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} />
                    {success}
                  </div>
                </div>
              )}

              {/* Cooldown Display */}
              {isOnCooldown && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    Cooldown: {formatCooldown(cooldownRemaining)} remaining
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="flex-1 btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCall}
                  disabled={loading || isDisabled}
                  className="flex-1 btn btn-primary bg-red-500 hover:bg-red-600 disabled:bg-gray-400"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader className="animate-spin" size={16} />
                      Submitting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      Call Admin
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminCallButton; 