import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import MigrationDashboard from '../components/admin/MigrationDashboard';

const AdminMigrationPage = () => {
  const { user, isAdmin, loading, adminCheckComplete } = useAuth();
  
  console.log('AdminMigrationPage Debug:', { 
    user: user ? 'exists' : 'null', 
    isAdmin, 
    userId: user?.id,
    loading,
    adminCheckComplete
  });

  if (loading || !adminCheckComplete) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    console.log('Redirecting - user or isAdmin is falsy');
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">RP Migration Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Admin Access</span>
        </div>
      </div>
      
      <MigrationDashboard />
    </div>
  );
};

export default AdminMigrationPage; 