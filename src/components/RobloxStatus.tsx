import React from 'react';
import { Gamepad2, Circle } from 'lucide-react';

interface RobloxStatusProps {
  username: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  lastUpdated?: number;
}

const RobloxStatus: React.FC<RobloxStatusProps> = ({
  username,
  isOnline,
  isInGame,
  inBedwars,
  lastUpdated
}) => {
  const getStatusColor = () => {
    if (!isOnline) return 'text-gray-400';
    if (inBedwars) return 'text-blue-600 dark:text-blue-400';
    if (isInGame) return 'text-green-600 dark:text-green-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (inBedwars) return 'In BedWars';
    if (isInGame) return 'In Game';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <Circle size={8} className="fill-current" />;
    if (inBedwars) return <Gamepad2 size={12} className="text-blue-600 dark:text-blue-400" />;
    if (isInGame) return <Gamepad2 size={12} className="text-green-600 dark:text-green-400" />;
    return <Circle size={8} className="fill-current text-green-600 dark:text-green-400" />;
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm">
          {username} ({getStatusText()})
        </span>
      </div>
      {lastUpdated && (
        <span className="text-xs text-gray-500">
          {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default RobloxStatus;