import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracking } from '../hooks/useTimeTracking';

interface TimeTrackingProviderProps {
  children: React.ReactNode;
}

const TimeTrackingProvider: React.FC<TimeTrackingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { timeStats, isTracking, startTracking, endTracking } = useTimeTracking();

  // Start time tracking when user is authenticated
  useEffect(() => {
    if (user?.id && !isTracking) {
      startTracking();
    }
  }, [user?.id, isTracking, startTracking]);

  // End time tracking when user logs out
  useEffect(() => {
    if (!user?.id && isTracking) {
      endTracking();
    }
  }, [user?.id, isTracking, endTracking]);

  // Optional: Show a subtle indicator when time tracking is active
  const showTrackingIndicator = user?.id && isTracking;

  return (
    <>
      {children}
      {showTrackingIndicator && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-green-600 text-white px-3 py-1 rounded-full text-xs shadow-lg animate-pulse">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
              Time tracking active
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TimeTrackingProvider; 