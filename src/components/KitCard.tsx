import React from 'react';
import { Kit, KitTypeColors, KitTypeIcons } from '../types';
import { Lock, Trophy } from 'lucide-react';
import { useBan } from '../context/BanContext';
import { useKits } from '../context/KitContext';

interface KitCardProps {
  kit: Kit;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const KitCard: React.FC<KitCardProps> = ({ 
  kit, 
  onClick, 
  size = 'md',
  showDetails = true 
}) => {
  const { isBanned } = useBan();
  const { selectedKitId } = useKits();
  
  if (!kit) {
    return null;
  }
  
  const banned = isBanned(kit.id);
  const selected = selectedKitId === kit.id;
  
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28'
  };

  const bgColorClass = KitTypeColors[kit.type];
  const imageUrl = kit.image_url || kit.imageUrl;

  const emojiSizeClass = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div 
      className={`kit-card ${bgColorClass} ${banned ? 'banned' : ''} ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className={`relative ${sizeClasses[size]}`}>
        <img 
          src={imageUrl} 
          alt={kit.name} 
          className={`object-cover rounded ${banned ? 'opacity-50' : ''}`}
        />
        
        {/* Type indicator with emoji only */}
        <div className={`absolute -top-1 -left-1 ${emojiSizeClass[size]} leading-none`}>
          {KitTypeIcons[kit.type]}
        </div>
        
        {/* Pay-locked indicator */}
        {kit.payLocked && (
          <div className="absolute top-0 right-0 bg-yellow-500 rounded-full p-0.5">
            <Lock size={size === 'sm' ? 10 : 14} className="text-white" />
          </div>
        )}
        
        {/* Battle Pass indicator */}
        {kit.battlePass && (
          <div className="absolute top-0 left-0 bg-purple-500 rounded-full p-0.5">
            <Trophy size={size === 'sm' ? 10 : 14} className="text-white" />
          </div>
        )}
      </div>
      
      {showDetails && (
        <div className="mt-2 text-center w-full">
          <h3 className={`font-medium truncate text-white ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            {kit.name}
          </h3>
          <p className={`text-xs uppercase text-white/80 ${size === 'sm' ? 'hidden' : ''}`}>
            {kit.type}
          </p>
        </div>
      )}
    </div>
  );
};

export default KitCard;