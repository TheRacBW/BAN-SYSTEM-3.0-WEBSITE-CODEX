import React, { useEffect, useState } from 'react';
import { leaderboardService } from '../../services/leaderboardService';

const rankColorSchemes: Record<string, any> = {
  'Bronze': {
    primary: '#CD7F32',
    secondary: '#8B4513',
    background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
    glow: 'rgba(205, 127, 50, 0.3)'
  },
  'Silver': {
    primary: '#C0C0C0',
    secondary: '#808080',
    background: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
    glow: 'rgba(192, 192, 192, 0.3)'
  },
  'Gold': {
    primary: '#FFD700',
    secondary: '#DAA520',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    glow: 'rgba(255, 215, 0, 0.3)'
  },
  'Platinum': {
    primary: '#4DD0E1',
    secondary: '#00BCD4',
    background: 'linear-gradient(135deg, #4DD0E1 0%, #00BCD4 100%)',
    glow: 'rgba(77, 208, 225, 0.3)'
  },
  'Diamond': {
    primary: '#3F51B5',
    secondary: '#1A237E',
    background: 'linear-gradient(135deg, #3F51B5 0%, #1976D2 100%)',
    glow: 'rgba(63, 81, 181, 0.3)'
  },
  'Emerald': {
    primary: '#4CAF50',
    secondary: '#2E7D32',
    background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
    glow: 'rgba(76, 175, 80, 0.3)'
  },
  'Nightmare': {
    primary: '#9C27B0',
    secondary: '#4A148C',
    background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
    glow: 'rgba(156, 39, 176, 0.4)'
  }
};

interface RankBadgeProps {
  rankTitle: string; // e.g. 'Diamond 2', 'Nightmare', 'Gold 3'
  rp: number;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({ rankTitle, rp, size = 'medium', className = '' }) => {
  const [rankIcons, setRankIcons] = useState<Map<string, string>>(new Map());
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    leaderboardService.getRankIcons().then(setRankIcons);
  }, []);

  // Extract tier and level
  const tier = rankTitle.split(' ')[0];
  const level = rankTitle.split(' ')[1] || '';
  const iconUrl = rankIcons.get(tier);
  const colorScheme = rankColorSchemes[tier] || rankColorSchemes['Bronze'];

  // Sizing
  const sizeMap = {
    small: { icon: 20, font: '0.85rem', pad: '4px 8px' },
    medium: { icon: 32, font: '1rem', pad: '8px 12px' },
    large: { icon: 48, font: '1.15rem', pad: '12px 18px' }
  };
  const s = sizeMap[size];

  return (
    <div
      className={`rank-badge rank-badge--${size} ${className}`}
      style={{
        background: colorScheme.background,
        boxShadow: `0 0 20px ${colorScheme.glow}`,
        padding: s.pad,
        borderRadius: 12,
        border: '2px solid rgba(255,255,255,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        ...(tier === 'Nightmare' ? { animation: 'nightmareGlow 2s ease-in-out infinite alternate' } : {})
      }}
      data-tier={tier}
    >
      {iconUrl && !iconError && (
        <img
          src={iconUrl}
          alt={`${tier} rank`}
          className="rank-icon"
          style={{ width: s.icon, height: s.icon }}
          onError={() => setIconError(true)}
        />
      )}
      <div className="rank-info" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="rank-tier" style={{ color: colorScheme.primary, fontWeight: 'bold', fontSize: s.font, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{tier}</span>
        {level && (
          <span className="rank-level" style={{ color: colorScheme.secondary, fontSize: '0.85em', opacity: 0.9 }}>{level}</span>
        )}
        <span className="rank-rp" style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.8)' }}>{rp} RP</span>
      </div>
    </div>
  );
};

export default RankBadge; 