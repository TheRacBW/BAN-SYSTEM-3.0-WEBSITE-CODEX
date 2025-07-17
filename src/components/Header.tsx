import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Moon, Sun, User, LogOut, Plus, TrendingUp, Settings, Home, Users, Trophy, Compass, Calculator } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src={theme === 'dark' ? '/therac-logo-white.png' : '/therac-logo-black.png'} 
              alt="TheRac's Kit Ban Planner" 
              className="h-16"
            />
          </Link>
          
          <div className="flex items-center gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `nav-icon-link${isActive ? ' active' : ''}`
              }
              title="Home"
              data-page="home"
            >
              <Home size={20} />
            </NavLink>

            <NavLink
              to="/strat-picker"
              className={({ isActive }) =>
                `nav-icon-link${isActive ? ' active' : ''}`
              }
              title="Strat Picker"
              data-page="strat-picker"
            >
              <Compass size={20} />
            </NavLink>
            
            <NavLink
              to="/leaderboard"
              className={({ isActive }) =>
                `nav-icon-link${isActive ? ' active' : ''}`
              }
              title="Leaderboard"
              data-page="leaderboard"
            >
              <Trophy size={20} />
            </NavLink>
            <NavLink
              to="/mmr-calculator"
              className={({ isActive }) =>
                `nav-icon-link${isActive ? ' active' : ''}`
              }
              title="MMR Calculator"
              data-page="calculator"
            >
              <Calculator size={20} />
            </NavLink>
            
            {user && (
              <>
                <NavLink
                  to="/players"
                  className={({ isActive }) =>
                    `nav-icon-link${isActive ? ' active' : ''}`
                  }
                  title="Player Tracking"
                  data-page="players"
                >
                  <Users size={20} />
                </NavLink>
              </>
            )}
            
            
            {user ? (
              <div className="flex items-center gap-2 mr-6">
                <Link
                  to="/dashboard"
                  className="btn btn-outline flex items-center gap-2"
                >
                  <User size={18} />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                
                <Link
                  to="/settings"
                  className="btn btn-outline"
                  title="Settings"
                >
                  <Settings size={18} />
                </Link>
                
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="btn btn-outline"
                  >
                    Admin
                  </Link>
                )}
                
                <button
                  onClick={handleSignOut}
                  className="btn btn-outline flex items-center gap-2"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link 
                to="/auth"
                className="btn btn-outline flex items-center gap-2"
              >
                <User size={18} />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;