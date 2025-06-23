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

const getRankIconUrl = (rankTitle: string): string => {
  const tier = rankTitle.toUpperCase().split(' ')[0];
  const iconUrls: Record<string, string> = {
    'NIGHTMARE': '/images/ranks/nightmare.png',
    'EMERALD': '/images/ranks/emerald.png',
    'DIAMOND': '/images/ranks/diamond.png',
    'PLATINUM': '/images/ranks/platinum.png',
    'GOLD': '/images/ranks/gold.png',
    'SILVER': '/images/ranks/silver.png',
    'BRONZE': '/images/ranks/bronze.png'
  };
  return iconUrls[tier] || iconUrls['BRONZE'];
};

const RankBadge: React.FC<RankBadgeProps> = ({ rankTitle, rp, size = 'medium', className = '' }) => {
  const [rankIcons, setRankIcons] = useState<Map<string, string>>(new Map());
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    leaderboardService.getRankIcons().then(setRankIcons);
  }, []);

  // Remove @ from rank title for display
  const displayRankTitle = rankTitle.startsWith('@') ? rankTitle.slice(1) : rankTitle;
  const tier = displayRankTitle.split(' ')[0];
  const level = displayRankTitle.split(' ')[1] || '';
  const iconUrl = rankIcons.get(tier);
  const colorScheme = rankColorSchemes[tier] || rankColorSchemes['Bronze'];

  // Sizing
  const sizeMap = {
    small: { icon: 20, font: '0.85rem', pad: '4px 8px' },
    medium: { icon: 32, font: '1rem', pad: '8px 16px' },
    large: { icon: 48, font: '1.15rem', pad: '12px 18px' }
  };
  const s = sizeMap[size];

  return (
    <div
      className={`rank-badge rank-badge--${size} rank-badge--${tier.toLowerCase()} ${className}`}
      style={{
        padding: s.pad,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)'
      }}
      data-tier={tier}
    >
      {iconUrl && !iconError && (
        <div className="rank-icon-container">
          <img
            src={iconUrl}
            alt={`${tier} rank`}
            className="rank-icon"
            style={{ width: s.icon, height: s.icon }}
            onError={() => setIconError(true)}
          />
        </div>
      )}
      <div className="rank-text-container">
        <div className="rank-tier">{tier}</div>
        {level && <div className="rank-level">{level}</div>}
        <div className="rank-rp">{rp} RP</div>
      </div>
    </div>
  );
};

export default RankBadge; 