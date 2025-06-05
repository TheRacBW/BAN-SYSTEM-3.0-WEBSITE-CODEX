import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignIn) {
        if (!email || !password) {
          setError('Please enter all required fields');
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('Please enter a valid email address');
          return;
        }

        try {
          await signIn(email.toLowerCase(), password);
          navigate('/dashboard');
        } catch (err) {
          if (err instanceof Error) {
            if (err.message.includes('Invalid login credentials')) {
              setError('Invalid email or password. Please try again.');
            } else {
              setError(err.message);
            }
          } else {
            setError('An error occurred during sign in');
          }
        }
      } else {
        if (!username || !email || !password) {
          setError('Please enter all required fields');
          return;
        }

        if (username.length < 3) {
          setError('Username must be at least 3 characters long');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('Please enter a valid email address');
          return;
        }

        await signUp(email.toLowerCase(), username.toLowerCase(), password);
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during authentication');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isSignIn ? 'Sign In' : 'Create Account'}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center">
            <AlertCircle className="mr-2" size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
              className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
              required
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          {!isSignIn && (
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
                required
                minLength={3}
                placeholder="Choose a username"
                disabled={isLoading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded focus:ring focus:ring-primary-300 dark:bg-gray-700 dark:border-gray-600"
              required
              minLength={6}
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="w-full btn btn-primary flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isSignIn ? (
              <>
                <LogIn size={18} />
                {isLoading ? 'Signing In...' : 'Sign In'}
              </>
            ) : (
              <>
                <UserPlus size={18} />
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignIn(!isSignIn);
              setError(null);
              setUsername('');
              setEmail('');
              setPassword('');
            }}
            className="text-primary-600 dark:text-primary-400 hover:underline"
            disabled={isLoading}
          >
            {isSignIn ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;