import React from 'react';
import BedWarsMMRCalculator from '../components/BedWarsMMRCalculator';
import { VerificationGuard } from '../components/auth';

const MMRCalculatorPage: React.FC = () => {
  return (
    <VerificationGuard pagePath="/mmr-calculator">
      <BedWarsMMRCalculator />
    </VerificationGuard>
  );
};

export default MMRCalculatorPage; 