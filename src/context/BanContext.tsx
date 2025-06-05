import React, { createContext, useContext, useState } from 'react';
import { BanState, Kit, Strategy } from '../types';

interface BanContextType {
  bans: BanState;
  currentTeam: 'teamA' | 'teamB';
  yourTeam: 'teamA' | 'teamB';
  addBan: (kitId: string) => void;
  removeBan: (kitId: string) => void;
  switchTeam: () => void;
  switchTeamVoting: () => void;
  resetBans: () => void;
  isBanned: (kitId: string) => boolean;
  getBannedKits: (kits: Kit[]) => Kit[];
  getValidStrategies: (strategies: Strategy[], kits: Kit[]) => Strategy[];
}

const BanContext = createContext<BanContextType | undefined>(undefined);

export const MAX_BANS_PER_TEAM = 2;

export const BanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bans, setBans] = useState<BanState>({ teamA: [], teamB: [] });
  const [currentTeam, setCurrentTeam] = useState<'teamA' | 'teamB'>('teamA');
  const [yourTeam, setYourTeam] = useState<'teamA' | 'teamB'>('teamA');

  const addBan = (kitId: string) => {
    if (bans[currentTeam].includes(kitId)) return;
    if (bans[currentTeam].length >= MAX_BANS_PER_TEAM) return;
    
    setBans(prev => ({
      ...prev,
      [currentTeam]: [...prev[currentTeam], kitId]
    }));

    // Automatically switch teams if max bans reached
    if (bans[currentTeam].length === MAX_BANS_PER_TEAM - 1) {
      switchTeamVoting();
    }
  };

  const removeBan = (kitId: string) => {
    setBans(prev => ({
      ...prev,
      teamA: prev.teamA.filter(id => id !== kitId),
      teamB: prev.teamB.filter(id => id !== kitId)
    }));
  };

  const switchTeam = () => {
    setYourTeam(prev => prev === 'teamA' ? 'teamB' : 'teamA');
  };

  const switchTeamVoting = () => {
    setCurrentTeam(prev => prev === 'teamA' ? 'teamB' : 'teamA');
  };

  const resetBans = () => {
    setBans({ teamA: [], teamB: [] });
    setCurrentTeam('teamA');
  };

  const isBanned = (kitId: string) => {
    return bans.teamA.includes(kitId) || bans.teamB.includes(kitId);
  };

  const getBannedKits = (kits: Kit[]): Kit[] => {
    const allBannedIds = [...bans.teamA, ...bans.teamB];
    return kits.filter(kit => allBannedIds.includes(kit.id));
  };

  const getValidStrategies = (strategies: Strategy[], kits: Kit[]): Strategy[] => {
    const allBannedIds = [...bans.teamA, ...bans.teamB];
    return strategies.filter(strategy => {
      return !strategy.kits.some(kitId => allBannedIds.includes(kitId));
    });
  };

  return (
    <BanContext.Provider value={{ 
      bans, 
      currentTeam,
      yourTeam,
      addBan, 
      removeBan, 
      switchTeam,
      switchTeamVoting,
      resetBans, 
      isBanned,
      getBannedKits,
      getValidStrategies
    }}>
      {children}
    </BanContext.Provider>
  );
};

export const useBan = (): BanContextType => {
  const context = useContext(BanContext);
  if (context === undefined) {
    throw new Error('useBan must be used within a BanProvider');
  }
  return context;
};