import React from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, User, LogOut, Plus, TrendingUp, Settings, Home, Users, Trophy, Compass, Calculator, Flag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRef, useEffect, useState } from 'react';
import { VerificationStatusBadge } from './auth';
import { usePageAccess } from '../hooks/usePageAccess';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { userStatus } = usePageAccess('/');

  // For sliding selection bar
  const navContainerRef = useRef<HTMLDivElement>(null);
  const iconRefs = {
    home: useRef<HTMLAnchorElement>(null),
    'strat-picker': useRef<HTMLAnchorElement>(null),
    leaderboard: useRef<HTMLAnchorElement>(null),
    calculator: useRef<HTMLAnchorElement>(null),
    players: useRef<HTMLAnchorElement>(null),
  };
  const [sliderStyle, setSliderStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [sliderClass, setSliderClass] = useState('');

  // Map routes to page keys
  const routeToPage: Record<string, keyof typeof iconRefs> = {
    '/': 'home',
    '/strat-picker': 'strat-picker',
    '/leaderboard': 'leaderboard',
    '/mmr-calculator': 'calculator',
    '/players': 'players',
  };

  useEffect(() => {
    const page = routeToPage[location.pathname as keyof typeof routeToPage];
    if (!page) {
      setSliderStyle({ opacity: 0 });
      return;
    }
    const iconEl = iconRefs[page].current;
    const containerEl = navContainerRef.current;
    if (iconEl && containerEl) {
      const iconRect = iconEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const left = iconRect.left - containerRect.left;
      const width = iconRect.width;
      setSliderStyle({
        left,
        width,
        opacity: 1,
      });
      setSliderClass(`nav-slider-bar ${page}`);
    } else {
      setSliderStyle({ opacity: 0 });
    }
  }, [location.pathname]);

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
          
          <div className="flex items-center gap-4 relative" ref={navContainerRef} style={{ minHeight: 40 }}>
            <div className={sliderClass} style={sliderStyle} />
            <NavLink
              to="/"
              className={({ isActive }) =>
                `nav-icon-link${isActive ? ' active' : ''}`
              }
              title="Home"
              data-page="home"
              ref={iconRefs.home}
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
              ref={iconRefs['strat-picker']}
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
              ref={iconRefs.leaderboard}
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
              ref={iconRefs.calculator}
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
                  ref={iconRefs.players}
                >
                  <Users size={20} />
                </NavLink>
                
                <NavLink
                  to="/report"
                  className={({ isActive }) =>
                    `nav-icon-link${isActive ? ' active' : ''}`
                  }
                  title="Submit Report"
                >
                  <Flag size={20} />
                </NavLink>
              </>
            )}
            
            
            {user ? (
              <div className="flex items-center gap-2 mr-6">
                <div className="flex items-center gap-2 mr-2">
                  <VerificationStatusBadge userStatus={userStatus} showDetails={false} />
                </div>
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