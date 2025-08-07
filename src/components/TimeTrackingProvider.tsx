import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimeTracking } from '../hooks/useTimeTracking';

interface TimeTrackingProviderProps {
  children: React.ReactNode;
}

const TimeTrackingProvider: React.FC<TimeTrackingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { timeStats, isTracking, startTracking, endTracking } = useTimeTracking();
  const [showTrackingPopup, setShowTrackingPopup] = useState(false);

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

  // Show temporary popup when tracking starts
  useEffect(() => {
    if (isTracking && user) {
      setShowTrackingPopup(true);
      // Hide popup after 3 seconds
      const timer = setTimeout(() => {
        setShowTrackingPopup(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isTracking, user]);

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
      {/* Temporary popup when time tracking starts */}
      {showTrackingPopup && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-lg text-sm shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            Time tracking active
          </div>
        </div>
      )}
    </>
  );
};

export default TimeTrackingProvider; 