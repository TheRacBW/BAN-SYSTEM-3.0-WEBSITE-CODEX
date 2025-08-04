import React from 'react';
import ReportSubmissionForm from '../components/ReportSubmissionForm';
import AdminCallButton from '../components/AdminCallButton';

const ReportPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <ReportSubmissionForm />
      </div>
      <AdminCallButton />
    </div>
  );
};

export default ReportPage; 