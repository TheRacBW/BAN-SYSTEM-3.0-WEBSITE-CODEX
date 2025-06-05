import { Kit, Strategy } from '../types';

export const mockKits: Kit[] = [
  {
    id: 'k1',
    name: 'War Machine',
    imageUrl: 'https://placehold.co/200x200/3b82f6/FFFFFF/png?text=War+Machine',
    type: 'tank',
    payLocked: true
  },
  {
    id: 'k2',
    name: 'Blade Master',
    imageUrl: 'https://placehold.co/200x200/ef4444/FFFFFF/png?text=Blade+Master',
    type: 'dps'
  },
  {
    id: 'k3',
    name: 'Guardian Angel',
    imageUrl: 'https://placehold.co/200x200/3b82f6/FFFFFF/png?text=Guardian+Angel',
    type: 'support'
  },
  {
    id: 'k4',
    name: 'Shadow Assassin',
    imageUrl: 'https://placehold.co/200x200/ef4444/FFFFFF/png?text=Shadow+Assassin',
    type: 'dps',
    payLocked: true
  },
  {
    id: 'k5',
    name: 'Iron Shield',
    imageUrl: 'https://placehold.co/200x200/16a34a/FFFFFF/png?text=Iron+Shield',
    type: 'tank'
  },
  {
    id: 'k6',
    name: 'Life Weaver',
    imageUrl: 'https://placehold.co/200x200/3b82f6/FFFFFF/png?text=Life+Weaver',
    type: 'support'
  },
  {
    id: 'k7',
    name: 'Fire Mage',
    imageUrl: 'https://placehold.co/200x200/ef4444/FFFFFF/png?text=Fire+Mage',
    type: 'dps'
  },
  {
    id: 'k8',
    name: 'Recon Specialist',
    imageUrl: 'https://placehold.co/200x200/a855f7/FFFFFF/png?text=Recon+Specialist',
    type: 'utility',
    battlePass: 'Season 3'
  },
  {
    id: 'k9',
    name: 'Shock Trooper',
    imageUrl: 'https://placehold.co/200x200/16a34a/FFFFFF/png?text=Shock+Trooper',
    type: 'tank',
    payLocked: true
  },
  {
    id: 'k10',
    name: 'Tech Support',
    imageUrl: 'https://placehold.co/200x200/3b82f6/FFFFFF/png?text=Tech+Support',
    type: 'support',
    battlePass: 'Season 2'
  },
  {
    id: 'k11',
    name: 'Sniper Elite',
    imageUrl: 'https://placehold.co/200x200/ef4444/FFFFFF/png?text=Sniper+Elite',
    type: 'dps'
  },
  {
    id: 'k12',
    name: 'Zone Controller',
    imageUrl: 'https://placehold.co/200x200/a855f7/FFFFFF/png?text=Zone+Controller',
    type: 'utility'
  }
];

export const mockStrategies: Strategy[] = [
  {
    id: 's1',
    name: 'Classic Balanced Composition',
    description: 'A well-rounded team with strong frontline and backline support',
    kits: ['k1', 'k2', 'k3', 'k7', 'k12'],
    winRate: 0.62,
    popularity: 92,
    effectiveness: 85,
    counterability: 65,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 's2',
    name: 'Double Tank Defense',
    description: 'Extremely durable composition focused on objective control',
    kits: ['k1', 'k5', 'k6', 'k11', 'k12'],
    winRate: 0.58,
    popularity: 75,
    effectiveness: 78,
    counterability: 70,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 's3',
    name: 'Triple DPS Aggression',
    description: 'High-risk, high-reward composition for aggressive playstyles',
    kits: ['k2', 'k4', 'k7', 'k3', 'k5'],
    winRate: 0.48,
    popularity: 63,
    effectiveness: 72,
    counterability: 80,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 's4',
    name: 'Utility Control',
    description: 'Map control focused composition with strong utility presence',
    kits: ['k5', 'k7', 'k6', 'k12', 'k8'],
    winRate: 0.55,
    popularity: 81,
    effectiveness: 75,
    counterability: 68,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 's5',
    name: 'Stealth Operation',
    description: 'Surprise-based composition with high mobility',
    kits: ['k4', 'k8', 'k11', 'k10', 'k5'],
    winRate: 0.52,
    popularity: 68,
    effectiveness: 70,
    counterability: 75,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 's6',
    name: 'Fortress Defense',
    description: 'Ultimate defensive setup with maximum survivability',
    kits: ['k1', 'k9', 'k6', 'k12', 'k3'],
    winRate: 0.60,
    popularity: 71,
    effectiveness: 82,
    counterability: 60,
    createdBy: 'system',
    isPublic: true,
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01')
  }
];