import { useState, useEffect } from 'react';
import { useRobloxStatus } from '../hooks/useRobloxStatus';
import { CircleDot, CircleSlash, Gamepad2 } from 'lucide-react';
import { BEDWARS_PLACE_ID, BEDWARS_UNIVERSE_ID } from '../constants/bedwars';

interface RobloxStatusProps {
  userId: number;
}

export default function RobloxStatus({ userId }: RobloxStatusProps) {
  const { status, loading, error } = useRobloxStatus(userId);

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
        <span>Checking status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
        <CircleSlash size={12} />
        <span>{error}</span>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <CircleDot
            size={12}
            className={status.isOnline ? 'text-green-500' : 'text-gray-400'}
          />
          <span className={status.isOnline ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
            {status.username} ({status.isInGame ? 'In Game' : status.isOnline ? 'Online' : 'Offline'})
          </span>
        </div>
        
        {(status.inBedwars ||
          Number(status.placeId) === BEDWARS_PLACE_ID ||
          Number(status.rootPlaceId) === BEDWARS_PLACE_ID ||
          Number(status.universeId) === BEDWARS_UNIVERSE_ID) && (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Gamepad2 size={12} />
            <span>In Bedwars</span>
          </div>
        )}
      </div>
    </div>
  );
}