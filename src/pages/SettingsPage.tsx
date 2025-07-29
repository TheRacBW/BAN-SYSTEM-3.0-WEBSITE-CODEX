import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Lock, User, AlertCircle, Check } from 'lucide-react';
import { UserVerificationDashboard } from '../components/auth';
import { usePageAccess } from '../hooks/usePageAccess';

const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { userStatus } = usePageAccess('/settings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchCurrentUsername();
  }, [user, navigate]);

  const fetchCurrentUsername = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.username) {
        setCurrentUsername(data.username);
        setUsername(data.username);
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      setError('Failed to load current username');
    }
  };

  const validateUsername = (username: string) => {
    if (username.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (username.length > 20) {
      return 'Username must be less than 20 characters';
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return 'Username can only contain letters and numbers';
    }
    return null;
  };

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (username === currentUsername) {
      setError('New username must be different from current username');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if username is available
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        setError('Username is already taken');
        return;
      }

      // Update username
      const { error: updateError } = await supabase
        .from('users')
        .update({ username })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setCurrentUsername(username);
      setSuccess('Username updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error updating username:', error);
      setError('Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        setError('Current password is incorrect');
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      setError('Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-200 mb-8">Settings</h1>

      {/* Verification Dashboard */}
      <div className="mb-8">
        <UserVerificationDashboard userStatus={userStatus} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Username Change Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <User size={20} />
            Change Username
          </h2>

          <form onSubmit={handleUsernameChange} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                New Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9]+"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Letters and numbers only, 3-20 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || username === currentUsername}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={18} />
                  Update Username
                </>
              )}
            </button>
          </form>
        </div>

        {/* Password Change Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lock size={20} />
            Change Password
          </h2>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                minLength={6}
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={18} />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;