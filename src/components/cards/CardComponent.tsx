import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Image } from 'lucide-react';
import { Card, RARITY_COLORS, CLASS_ICONS, SEASON_IMAGES } from '../../types/cards';
import './CardComponent.css';

// Text color helpers
const getTextColors = (theme: 'dark' | 'light') => {
  if (theme === 'light') {
    return {
      primary: '#ffffff',        // Kit name, HP, Ability name
      secondary: '#e5e5e5',      // Variant name, Ability description  
      tertiary: '#d1d1d1',       // Flavor text
      muted: '#cccccc'           // Footer text
    };
  } else {
    return {
      primary: '#1f2937',        // Kit name, HP, Ability name (gray-800)
      secondary: '#4b5563',      // Variant name, Ability description (gray-600)
      tertiary: '#6b7280',       // Flavor text (gray-500)
      muted: '#6b7280'           // Footer text (gray-500)
    };
  }
};

// Helper function to convert hex to rgb for transparency
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const getFrameStyle = (color: string, opacity: number) => {
  const rgb = hexToRgb(color);
  if (!rgb) return { backgroundColor: `rgba(255, 255, 255, ${opacity})` };
  return { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` };
};

interface CardComponentProps {
  card: Card;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  scale?: number;
}

const CardComponent: React.FC<CardComponentProps> = ({ 
  card, 
  interactive = false, 
  onClick,
  className = '',
  scale = 1
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isActive, setIsActive] = useState(false);
  const [transform, setTransform] = useState({ rx: 0, ry: 0, scale: 1 });
  
  const canHaveHolo = ['Epic', 'Legendary'].includes(card.rarity) && card.is_holo;
  const textColors = getTextColors(card.text_theme);

  useEffect(() => {
    if (!interactive || !cardRef.current) return;

    const cardElement = cardRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = cardElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const x = ((e.clientX - centerX) / (rect.width / 2)) * 100;
      const y = ((e.clientY - centerY) / (rect.height / 2)) * 100;
      
      setMousePos({ 
        x: Math.min(Math.max(x + 50, 0), 100), 
        y: Math.min(Math.max(y + 50, 0), 100) 
      });
      
      const rx = y * -0.15;
      const ry = x * 0.15;
      
      setTransform({ rx, ry, scale: 1.05 });
    };

    const handleMouseEnter = () => {
      setIsActive(true);
    };

    const handleMouseLeave = () => {
      setIsActive(false);
      setTransform({ rx: 0, ry: 0, scale: 1 });
      setMousePos({ x: 50, y: 50 });
    };

    cardElement.addEventListener('mousemove', handleMouseMove);
    cardElement.addEventListener('mouseenter', handleMouseEnter);
    cardElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cardElement.removeEventListener('mousemove', handleMouseMove);
      cardElement.removeEventListener('mouseenter', handleMouseEnter);
      cardElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [interactive]);

  const cardStyle = {
    '--mx': `${mousePos.x}%`,
    '--my': `${mousePos.y}%`,
    '--posx': `${mousePos.x}%`,
    '--posy': `${mousePos.y}%`,
    transform: `perspective(600px) rotateX(${transform.rx}deg) rotateY(${transform.ry}deg) scale(${transform.scale * scale})`,
    transition: isActive ? 'none' : 'all 0.3s ease-out'
  } as React.CSSProperties;

  return (
    <div className={`card-container ${className}`} style={{ perspective: '600px' }}>
      <div 
        ref={cardRef}
        className={`pokemon-card ${isActive ? 'active' : ''} ${canHaveHolo ? 'holo' : ''}`}
        style={cardStyle}
        onClick={onClick}
      >
        <div className="card-front">
          {canHaveHolo && (
            <div 
              className="card-shine" 
              data-holo-type={card.holo_type}
              data-mask-enabled={card.has_holo_mask ? "true" : "false"}
              style={cardStyle}
            />
          )}

          {/* Custom Holo Mask Layer */}
          {canHaveHolo && card.has_holo_mask && card.holo_mask_url && (
            <div 
              className="card-holo-mask"
              data-holo-type={card.holo_type}
              style={{
                ...cardStyle,
                maskImage: `url(${card.holo_mask_url})`,
                WebkitMaskImage: `url(${card.holo_mask_url})`,
                maskSize: 'cover',
                WebkitMaskSize: 'cover',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat'
              }}
            />
          )}

          <div className="card-content relative w-80 h-112 rounded-xl overflow-hidden shadow-2xl"
               style={{ 
                 backgroundColor: card.background_color,
                 border: card.has_border ? `4px solid ${card.border_color}` : 'none'
               }}>

            {/* Background Image Layer */}
            {card.background_image_url && (
              <div 
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${card.background_image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            )}
            
            <div className="relative z-10 p-4 bg-gradient-to-b backdrop-blur-sm"
                 style={{
                   background: `linear-gradient(to bottom, rgba(${hexToRgb(card.card_frame_color)?.r || 255}, ${hexToRgb(card.card_frame_color)?.g || 255}, ${hexToRgb(card.card_frame_color)?.b || 255}, 0.95) 0%, rgba(${hexToRgb(card.card_frame_color)?.r || 255}, ${hexToRgb(card.card_frame_color)?.g || 255}, ${hexToRgb(card.card_frame_color)?.b || 255}, 0.85) 100%)`
                 }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-bold" style={{ color: textColors.primary }}>{card.kit_name}</h3>
                  {card.variant_name && (
                    <p className="text-sm italic" style={{ color: textColors.secondary }}>{card.variant_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="text-sm font-bold" style={{ color: textColors.primary }}>{card.hp} HP</div>
                    {card.class_type && CLASS_ICONS[card.class_type] && (
                      <div className="text-lg">{CLASS_ICONS[card.class_type]}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <div className="w-3 flex justify-center">
                      {canHaveHolo && <Sparkles size={12} className="text-purple-500" />}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded text-white ${
                      card.rarity === 'Legendary' ? 'bg-orange-500' :
                      card.rarity === 'Epic' ? 'bg-purple-500' :
                      card.rarity === 'Rare' ? 'bg-blue-500' :
                      card.rarity === 'Uncommon' ? 'bg-green-500' : 'bg-gray-500'
                    }`}>
                      {card.rarity}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-center p-6 h-48">
              {card.image_url ? (
                <img 
                  src={card.image_url} 
                  alt={card.kit_name} 
                  className="w-36 h-36 object-cover rounded-lg border-2 border-white/50 shadow-lg"
                  onError={(e) => {
                    console.log('Image failed to load:', card.image_url);
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                  onLoad={(e) => {
                    console.log('Image loaded successfully:', card.image_url);
                    e.currentTarget.nextElementSibling?.classList.add('hidden');
                  }}
                />
              ) : null}
              
              {/* Fallback when no image URL or image fails to load */}
              <div className={`w-36 h-36 bg-white/20 rounded-lg border-2 border-white/50 flex items-center justify-center ${card.image_url ? 'hidden' : ''}`}>
                <Image size={32} className="text-white/60" />
                {card.image_url && (
                  <div className="absolute bottom-2 left-2 right-2 text-xs text-white bg-red-500/80 p-1 rounded">
                    Image failed to load
                  </div>
                )}
              </div>

              {card.show_season_overlay && card.season && SEASON_IMAGES[card.season] && (
                <div className="absolute bottom-2 right-2 flex flex-col items-center z-30 pointer-events-none">
                  <img 
                    src={SEASON_IMAGES[card.season]} 
                    alt={card.season}
                    className="w-12 h-12 opacity-90 drop-shadow-lg mb-1"
                    style={{ 
                      filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.6)) drop-shadow(0 0 8px rgba(255,255,255,0.3))'
                    }}
                  />
                  <span className="text-xs font-bold text-white drop-shadow-lg bg-black/40 px-2 py-1 rounded">
                    {card.season}
                  </span>
                </div>
              )}
            </div>

            <div className="relative z-10 p-4 bg-gradient-to-t backdrop-blur-sm"
                 style={{
                   background: `linear-gradient(to top, rgba(${hexToRgb(card.card_frame_color)?.r || 255}, ${hexToRgb(card.card_frame_color)?.g || 255}, ${hexToRgb(card.card_frame_color)?.b || 255}, 0.95) 0%, rgba(${hexToRgb(card.card_frame_color)?.r || 255}, ${hexToRgb(card.card_frame_color)?.g || 255}, ${hexToRgb(card.card_frame_color)?.b || 255}, 0.85) 100%)`
                 }}>
              <div className="space-y-3">
                {card.ability_name && (
                  <div className="rounded-lg p-3"
                       style={{
                         backgroundColor: `rgba(${hexToRgb(card.card_frame_color)?.r || 255}, ${hexToRgb(card.card_frame_color)?.g || 255}, ${hexToRgb(card.card_frame_color)?.b || 255}, 0.6)`
                       }}>
                    <h4 className="font-bold text-sm mb-1" style={{ color: textColors.primary }}>{card.ability_name}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: textColors.secondary }}>
                      {card.ability_description?.slice(0, 100)}
                      {card.ability_description && card.ability_description.length > 100 && '...'}
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-xs">
                  <div className="flex gap-2">
                    {card.weakness && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                        Weak: {card.weakness}
                      </span>
                    )}
                    {card.resistance !== 'None' && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        Resist: {card.resistance}
                      </span>
                    )}
                  </div>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    Retreat: {card.retreat_cost}
                  </span>
                </div>

                {card.flavor_text && (
                  <p className="text-xs italic text-center mt-2 border-t pt-2" style={{ color: textColors.tertiary }}>
                    "{card.flavor_text}"
                  </p>
                )}

                <div className="flex justify-between items-center text-xs border-t pt-2" style={{ color: textColors.muted }}>
                  <span>{card.season}</span>
                  <span>{card.unlock_requirement}</span>
                </div>
              </div>
            </div>
          </div>

          {card.has_border && !card.border_behind_holo && (
            <div 
              className="absolute inset-0 rounded-xl border-4 z-20 pointer-events-none"
              style={{ borderColor: card.border_color }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CardComponent; 