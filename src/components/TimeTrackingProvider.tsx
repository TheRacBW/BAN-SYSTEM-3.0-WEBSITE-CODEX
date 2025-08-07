import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracking } from '../hooks/useTimeTracking';

interface TimeTrackingProviderProps {
  children: React.ReactNode;
}

const TimeTrackingProvider: React.FC<TimeTrackingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { timeStats, isTracking, startTracking, endTracking } = useTimeTracking();

  // Start tracking when user is authenticated
  useEffect(() => {
    if (user?.id && !isTracking) {
      startTracking();
    }
  }, [user?.id, isTracking, startTracking]);

  // End tracking when user logs out
  useEffect(() => {
    if (!user?.id && isTracking) {
      endTracking();
    }
  }, [user?.id, isTracking, endTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTracking) {
        endTracking();
      }
    };
  }, [isTracking, endTracking]);

  return (
    <>
      {children}
      {/* Optional: Show a subtle indicator when time tracking is active */}
      {isTracking && user && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs opacity-75">
          Time tracking active
        </div>
      )}
    </>
  );
};

export default TimeTrackingProvider; 