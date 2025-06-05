import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({ value, onChange, size = 'md' }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [selectedValue, setSelectedValue] = useState<number>(value);
  
  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const starSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  const handleStarClick = (rating: number) => {
    setSelectedValue(rating);
    onChange(rating);
  };

  const handleMouseEnter = (rating: number) => {
    setHoverValue(rating);
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
  };

  // Use hover value if available, otherwise use the selected value
  const displayValue = hoverValue !== null ? hoverValue : selectedValue;

  return (
    <div className="flex items-center">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = displayValue >= star;
          const half = !filled && displayValue >= star - 0.5;
          
          return (
            <div 
              key={star} 
              className="relative cursor-pointer"
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
            >
              <Star
                size={starSizes[size]}
                className={`${
                  filled
                    ? 'text-yellow-400 fill-yellow-400'
                    : half
                    ? 'text-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                } transition-colors`}
              />
              {half && (
                <div className="absolute inset-0 overflow-hidden w-[50%]">
                  <Star
                    size={starSizes[size]}
                    className="text-yellow-400 fill-yellow-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {displayValue.toFixed(1)}
      </span>
    </div>
  );
};

export default StarRating;