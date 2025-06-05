import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { BanProvider } from './context/BanContext';
import { KitProvider } from './context/KitContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CreateStrategyPage from './pages/CreateStrategyPage';
import TrendingPage from './pages/TrendingPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import SettingsPage from './pages/SettingsPage';
import PlayersPage from './pages/PlayersPage';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <BanProvider>
            <KitProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                
                <main className="flex-grow container mx-auto px-4 py-6">
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/create" element={<CreateStrategyPage />} />
                    <Route path="/trending" element={<TrendingPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/players" element={<PlayersPage />} />
                  </Routes>
                </main>
                
                <Footer />
              </div>
            </KitProvider>
          </BanProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;