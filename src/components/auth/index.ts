// Export all verification components
export { VerificationGuard } from './VerificationGuard';
export { VerificationPopup } from './VerificationPopup';
export { VerificationStatusBadge } from './VerificationStatusBadge';
export { UserVerificationDashboard } from './UserVerificationDashboard';
export { CacheStatusIndicator } from './CacheStatusIndicator';

// Export types from usePageAccess hook
export type { 
  UserVerificationStatus, 
  PageAccessRequirements, 
  PageAccessResult 
} from '../../hooks/usePageAccess';