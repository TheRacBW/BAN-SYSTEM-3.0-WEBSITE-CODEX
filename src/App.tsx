import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { BanProvider } from './context/BanContext';
import { KitProvider } from './context/KitContext';
import { AdminAvailabilityProvider } from './context/AdminAvailabilityContext';
import Header from './components/Header';
import Footer from './components/Footer';
import { CacheStatusIndicator } from './components/auth';
import FloatingAdminPanel from './components/FloatingAdminPanel';
import AdminAudioManager from './components/AdminAudioManager';
import TimeTrackingProvider from './components/TimeTrackingProvider';
import HomePage from './pages/HomePage';
import CreateStrategyPage from './pages/CreateStrategyPage';
import TrendingPage from './pages/TrendingPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import AdminMigrationPage from './pages/AdminMigrationPage';
import AuthPage from './pages/AuthPage';
import SettingsPage from './pages/SettingsPage';
import PlayersPage from './pages/PlayersPage';
import LeaderboardPage from './pages/LeaderboardPage';
import StratPickerPage from './pages/StratPickerPage';
import MMRCalculatorPage from './pages/MMRCalculatorPage';
import ReportPage from './pages/ReportPage';
import PackOpeningPage from './pages/PackOpeningPage';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <BanProvider>
            <KitProvider>
              <AdminAvailabilityProvider>
                <TimeTrackingProvider>
                  <div className="min-h-screen flex flex-col">
                    <Header />
                    
                    <main className="flex-grow container mx-auto px-4 py-6">
                      <Routes>
                        <Route path="/" element={<div className="text-center py-20 text-2xl font-bold">Home coming soon!</div>} />
                        <Route path="/strat-picker" element={<StratPickerPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/admin/migration" element={<AdminMigrationPage />} />
                        <Route path="/auth" element={<AuthPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/players" element={<PlayersPage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                        <Route path="/mmr-calculator" element={<MMRCalculatorPage />} />
                        <Route path="/report" element={<ReportPage />} />
                        <Route path="/cards" element={<PackOpeningPage />} />
                      </Routes>
                    </main>
                    
                    <Footer />
                    <CacheStatusIndicator />
                    <FloatingAdminPanel />
                    <AdminAudioManager />
                  </div>
                </TimeTrackingProvider>
              </AdminAvailabilityProvider>
            </KitProvider>
          </BanProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;