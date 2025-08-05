# Card System Implementation

## Overview

The card system is a comprehensive feature that allows users to collect, trade, and display BedWars-themed cards. It includes pack opening mechanics, coin earning systems, goal tracking, and admin management tools.

## Features

### 🎴 Card Collection
- **Interactive Cards**: Cards with 3D hover effects and holo animations
- **Rarity System**: Common, Uncommon, Rare, Epic, and Legendary cards
- **Holo Effects**: Multiple holo effect types for Epic and Legendary cards
- **Card Equipping**: Users can equip cards as profile pictures

### 📦 Pack Opening
- **Multiple Pack Types**: Season Pack, Robux Pack, Event Pack, etc.
- **Rarity Distribution**: Configurable drop rates for each pack type
- **Opening Animations**: Smooth card reveal animations
- **Cost System**: Different pack prices and coin costs

### 🪙 Coin System
- **Earning Methods**:
  - Time spent on website (1 coin per 5 minutes)
  - Daily goals completion
  - Admin assignments
  - Discord account linking (future)
  - Player tracking contributions (future)
- **Spending**: Used to purchase card packs
- **Tracking**: Total earned vs current balance

### 🎯 Goal System
- **Daily Goals**: Time spent, packs opened, cards collected
- **Rewards**: Coin bonuses for completing goals
- **Progress Tracking**: Visual progress bars and completion status

### ⏱️ Session Tracking
- **Automatic Tracking**: Records user time on website
- **Coin Calculation**: Converts time to coins earned
- **Session Management**: Start/end session functionality

### 🔧 Admin Tools
- **Card Management**: Create, edit, delete cards
- **Pack Configuration**: Manage pack types and rarity weights
- **User Management**: Assign coins, view user statistics
- **System Analytics**: Track card distribution and usage

## Database Schema

### Tables

#### `cards`
Stores all card data including visual properties, stats, and metadata.

```sql
CREATE TABLE cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_name text NOT NULL,
    variant_name text,
    season text NOT NULL,
    class_type text NOT NULL,
    rarity text NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
    is_holo boolean DEFAULT false,
    holo_type text DEFAULT 'basic',
    card_type text NOT NULL DEFAULT 'Kit' CHECK (card_type IN ('Kit', 'Skin')),
    pack_type text NOT NULL,
    image_url text,
    background_color text DEFAULT '#5b3434',
    background_image_url text,
    ability_name text,
    ability_description text,
    flavor_text text,
    hp integer DEFAULT 100,
    weakness text,
    resistance text DEFAULT 'None',
    retreat_cost integer DEFAULT 2,
    unlock_requirement text,
    show_season_overlay boolean DEFAULT true,
    has_border boolean DEFAULT false,
    border_color text DEFAULT '#FFD700',
    border_behind_holo boolean DEFAULT true,
    has_holo_mask boolean DEFAULT false,
    holo_mask_url text,
    card_frame_color text DEFAULT '#ffffff',
    text_theme text DEFAULT 'dark' CHECK (text_theme IN ('dark', 'light')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
```

#### `pack_types`
Defines different types of card packs available for purchase.

```sql
CREATE TABLE pack_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    price integer NOT NULL DEFAULT 100,
    card_count integer NOT NULL DEFAULT 5,
    rarity_weights jsonb NOT NULL DEFAULT '{"Common": 55, "Uncommon": 25, "Rare": 12, "Epic": 6, "Legendary": 1.5}',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);
```

#### `user_coins`
Tracks user coin balance and earnings.

```sql
CREATE TABLE user_coins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coins integer NOT NULL DEFAULT 0,
    total_earned integer NOT NULL DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now(),
    UNIQUE(user_id)
);
```

#### `user_inventory`
Stores user card collections and equipped cards.

```sql
CREATE TABLE user_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    is_equipped boolean DEFAULT false,
    obtained_at timestamp with time zone DEFAULT now(),
    obtained_from text DEFAULT 'pack',
    UNIQUE(user_id, card_id)
);
```

#### `user_goals`
Tracks user goals and achievements for coin rewards.

```sql
CREATE TABLE user_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type text NOT NULL CHECK (goal_type IN ('daily_time', 'weekly_time', 'cards_collected', 'packs_opened', 'coins_earned')),
    target_value integer NOT NULL,
    current_value integer NOT NULL DEFAULT 0,
    reward_coins integer NOT NULL DEFAULT 0,
    is_completed boolean DEFAULT false,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);
```

#### `user_session_time`
Tracks user time spent on website for coin rewards.

```sql
CREATE TABLE user_session_time (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_start timestamp with time zone NOT NULL,
    session_end timestamp with time zone,
    duration_seconds integer,
    coins_earned integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);
```

#### `pack_opening_history`
Tracks pack opening history for analytics.

```sql
CREATE TABLE pack_opening_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pack_type_id uuid NOT NULL REFERENCES pack_types(id),
    cards_obtained jsonb NOT NULL,
    coins_spent integer NOT NULL,
    opened_at timestamp with time zone DEFAULT now()
);
```

## Components

### Core Components

#### `CardComponent.tsx`
Renders individual cards with interactive effects and holo animations.

**Features:**
- 3D hover effects with mouse tracking
- Multiple holo effect types
- Responsive design
- Fallback image handling
- Season overlays

#### `PackOpeningPage.tsx`
Main page for pack opening and card collection management.

**Features:**
- Pack selection and opening
- Inventory management
- Goal tracking
- Statistics display
- Session time tracking

#### `CardManagementPanel.tsx`
Admin panel for managing cards and pack types.

**Features:**
- Card creation and editing
- Pack type configuration
- System statistics
- Data export functionality

### Services

#### `CardService.ts`
Comprehensive service for all card-related database operations.

**Key Methods:**
- `getAllCards()`: Fetch all cards
- `openPack()`: Open a pack and get random cards
- `getUserCoins()`: Get user coin balance
- `equipCard()`: Equip a card as profile picture
- `startSession()` / `endSession()`: Track user time
- `createDailyGoals()`: Generate daily goals

### Hooks

#### `useCardSystem.ts`
Custom hook for managing card system state and operations.

**Features:**
- Centralized state management
- Error handling
- Loading states
- Data synchronization

## Usage

### For Users

1. **Access the Card System**
   - Navigate to `/cards` or click the Package icon in the header
   - Must be logged in to access

2. **Earn Coins**
   - Stay on the website to earn coins over time
   - Complete daily goals for bonus coins
   - Link Discord account (future feature)

3. **Open Packs**
   - Select a pack type based on your coin balance
   - Click "Open Pack" to reveal cards
   - Cards are automatically added to your inventory

4. **Manage Collection**
   - View your card collection in the Inventory tab
   - Equip cards as profile pictures
   - Track progress in the Goals tab

### For Admins

1. **Access Admin Panel**
   - Navigate to `/admin` and click "Card Management"
   - Must have admin privileges

2. **Create Cards**
   - Use the card builder to create new cards
   - Configure visual properties, stats, and rarity
   - Preview cards in real-time

3. **Manage Pack Types**
   - Configure pack prices and card counts
   - Set rarity distribution weights
   - Enable/disable pack types

4. **User Management**
   - Assign coins to users
   - View user statistics and progress
   - Monitor system usage

## Configuration

### Default Pack Types

The system comes with pre-configured pack types:

- **Season Pack**: 100 coins, 5 cards, basic distribution
- **Robux Pack**: 250 coins, 5 cards, better odds
- **Event Pack**: 150 coins, 5 cards, special events
- **Whisper Pack**: 200 coins, 5 cards, Whisper-themed
- **Nightmare Pack**: 300 coins, 5 cards, dark theme
- **Free Kit Pack**: 0 coins, 3 cards, basic cards only

### Holo Effects

Available holo effect types:

- **Basic**: Simple glare effect
- **Reverse**: Background foil with masked glare
- **Rare Holo**: Classic vertical beam effect
- **Galaxy**: Galaxy background with rainbow gradients
- **Amazing**: Intense glitter effect
- **Radiant**: Criss-cross linear gradient pattern
- **Trainer Gallery**: Metallic iridescent effect

### Goal Types

Supported goal types:

- `daily_time`: Time spent on website
- `weekly_time`: Weekly time tracking
- `cards_collected`: Number of cards collected
- `packs_opened`: Number of packs opened
- `coins_earned`: Total coins earned

## Security

### Row Level Security (RLS)

All tables have RLS policies configured:

- **Cards**: Readable by all, admin-only write access
- **Pack Types**: Readable by all, admin-only write access
- **User Data**: Users can only access their own data
- **Admin Functions**: Admin-only access for management functions

### Data Validation

- Rarity values are constrained to valid options
- Card types are validated against allowed values
- Goal types are restricted to predefined options
- User IDs are validated against auth.users table

## Performance Considerations

### Egress Optimization

- Session time is tracked locally and synced periodically
- Card data is cached to reduce database queries
- Pack opening uses efficient random selection algorithms
- Inventory updates are batched where possible

### Caching Strategy

- Card data is cached in the frontend
- User inventory is cached with periodic refresh
- Pack types are cached until manually refreshed
- Session data is stored locally with periodic sync

## Future Enhancements

### Planned Features

1. **Discord Integration**
   - Link Discord accounts for bonus coins
   - Discord role-based rewards
   - Server-specific card collections

2. **Trading System**
   - Card trading between users
   - Trade history and verification
   - Market place for rare cards

3. **Achievement System**
   - Collection milestones
   - Special event cards
   - Seasonal challenges

4. **Advanced Analytics**
   - Pack opening statistics
   - User behavior tracking
   - Economic balance monitoring

### Technical Improvements

1. **Real-time Updates**
   - WebSocket integration for live updates
   - Real-time pack opening notifications
   - Live goal progress updates

2. **Mobile Optimization**
   - Touch-friendly card interactions
   - Responsive pack opening interface
   - Mobile-optimized animations

3. **Performance Enhancements**
   - Virtual scrolling for large collections
   - Lazy loading for card images
   - Optimized holo effect rendering

## Troubleshooting

### Common Issues

1. **Cards not loading**
   - Check database connection
   - Verify RLS policies
   - Clear browser cache

2. **Pack opening fails**
   - Ensure user has sufficient coins
   - Check pack type configuration
   - Verify card availability for pack type

3. **Session tracking issues**
   - Check browser permissions
   - Verify user authentication
   - Clear local storage if needed

### Debug Tools

- Database migration: `supabase/migrations/20250108000000_create_card_system.sql`
- Service logs: Check browser console for errors
- Network tab: Monitor API calls and responses
- Admin panel: View system statistics and user data

## Contributing

When adding new features to the card system:

1. **Database Changes**
   - Create new migration files
   - Update TypeScript types
   - Add RLS policies

2. **Component Updates**
   - Follow existing patterns
   - Add proper error handling
   - Include loading states

3. **Service Updates**
   - Add methods to CardService
   - Update useCardSystem hook
   - Maintain backward compatibility

4. **Testing**
   - Test with different user roles
   - Verify admin functionality
   - Check mobile responsiveness 