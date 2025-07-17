# BedWars MMR (Glicko-2 Powered) System

## Overview
This project implements a dynamic, realistic BedWars MMR (Matchmaking Rating) calculator and progression predictor using a Glicko-2 inspired system. It simulates how a player's skill, rank, and RP evolve over time, closely matching the real BedWars ranked experience.

---

## Glicko-2 System: Core Concepts
- **Glicko-2** is a rating system that models player skill, rating deviation (uncertainty), and volatility (consistency).
- In this adaptation, each player has:
  - **MMR (Matchmaking Rating)**: Numeric skill estimate (e.g., 1500)
  - **RD (Rating Deviation)**: Uncertainty in skill (lower = more confident)
  - **Volatility**: How much a player's skill is expected to change
- Each rank (Bronze, Silver, Gold, etc.) has a baseline MMR value, and each RP value within a rank interpolates between the current and next rank's baseline.

---

## Factors Used in RP and Glicko Calculation
### 1. **Skill Gap**
- Calculated as the difference between the player's current MMR and the expected MMR for their current RP within their rank.
- Formula:
  ```js
  skillGap = currentMMR - (rankBaselineMMR + (nextRankMMR - rankBaselineMMR) * (currentRP / 100))
  ```

### 2. **Base RP Values**
- Win: +15 RP
- Loss: -12 RP

### 3. **Skill Gap Multiplier**
- If you are above the expected skill for your RP, you gain less RP for wins and lose more for losses.
- If you are below, you gain more for wins and lose less for losses.
- Win: `Math.max(0.6, 1.0 - (skillGap / 400))`
- Loss: `Math.min(1.4, 1.0 + Math.abs(skillGap) / 500)`

### 4. **Rank Difficulty Multipliers**
- Each rank tier has a multiplier to reflect real BedWars difficulty:
  ```js
  const RANK_DIFFICULTY_MULTIPLIERS = {
    'BRONZE': 1.35,
    'SILVER': 1.15,
    'GOLD': 1.0,
    'PLATINUM': 0.85,
    'DIAMOND': 0.7,
    'EMERALD': 0.55,
    'NIGHTMARE': 0.4
  };
  ```

### 5. **Within-Rank Progression Multiplier**
- As you approach 99 RP in a rank, it gets harder to gain RP:
  ```js
  withinRankMultiplier = 1.0 - (currentRP / 100) * 0.15 // Up to 15% harder at 99 RP
  ```

### 6. **Promotion/Demotion Effects**
- After a promotion, your RP gain is further reduced (you're "below average" for the new rank).
- After a demotion, you get a recovery bonus.
- Uses the new rank's interpolated MMR for skill gap.

### 7. **MMR Update After Each Match**
- MMR changes are sensitive to both match result and skill gap:
  ```js
  const baseChange = matchResult === 'win' ? 25 : -18;
  const rdFactor = Math.max(0.5, currentRD / 2.0);
  const skillFactor = 1 + Math.abs(skillGap) / 200;
  const ratingChange = baseChange * rdFactor * skillFactor * (matchResult === 'win' ? 1 : -1);
  ```
- RD and volatility are also updated each match.

### 8. **Shield System**
- If you lose at 0 RP and have shield games left, your RP doesn't drop, but your MMR still decreases.
- Up to 3 shielded losses per rank.

---

## How the Calculator Works
### Inputs
- **Current Rank** (e.g., SILVER_2)
- **Current RP** (0-99)
- **Total Wins (Season)**
- **Shield Games Used**
- **Is New Season?** (and previous season MMR)
- **Recent Match History** (for dynamic averages)

### Outputs
- **Estimated MMR** (skill)
- **Expected RP Gain** (next match)
- **Accuracy Score** (based on data quality)
- **Underranked/Overranked status**
- **Demotion Shield status**

---

## How the Progression Prediction Works
### Step-by-Step Simulation
1. **Initialize** with current MMR, RD, volatility, RP, rank, and shield games.
2. For each simulated match:
   - Randomly determine win/loss based on expected win rate.
   - Calculate dynamic RP gain/loss using all multipliers (skill gap, rank, within-rank, etc.).
   - Apply shield logic if at 0 RP and shield games remain.
   - Update RP and check for promotion/demotion.
   - If promoted/demoted, apply immediate RP adjustment using new rank's MMR.
   - Update MMR, RD, and volatility using match result and skill gap.
   - Store all results for graph/table.
3. Repeat for the desired number of games.

### Dynamic Data
- All calculations are based on the evolving state after each match (MMR, RP, rank, shield, etc.).
- The simulation is not static: each match outcome affects the next.

---

## Example Flow
1. **Start as SILVER_2, 45 RP, MMR 1576**
2. Win a match:
   - Skill gap is calculated, all multipliers applied, RP gain is high (e.g., +13)
   - MMR increases, skill gap shrinks
3. Win again:
   - RP gain is slightly lower (e.g., +12)
   - MMR increases again
4. Approach 99 RP:
   - Within-rank multiplier reduces RP gain further
5. Promote to SILVER_3:
   - Immediate RP gain is much lower (you're below average for new rank)
   - MMR continues to evolve
6. Continue climbing:
   - RP gains get smaller as you approach Gold, Diamond, etc.

---

## UI/Visualization
- **Graph**: Shows RP and MMR progression over simulated matches
- **Table**: Lists each match, RP, rank, MMR, skill gap, and promotion/demotion events
- **Summary**: Final RP, rank, total RP gain, average RP per match, skill evolution

---

## Tuning & Caveats
- All multipliers and base values can be tuned for realism
- The system is a close simulation, not a perfect replica of Roblox BedWars
- Shield logic is simplified for simulation
- MMR is powered by a Glicko-2 system, adapted for clarity and performance, not a full statistical implementation

---

## For Developers & Advanced Users
- All logic is in `src/components/BedWarsMMRCalculator.tsx`
- Key functions: `calculateSkillGap`, `calculateDynamicRP`, `updateMMRAfterMatch`, `adjustRPForRankChange`, `simulateRPProgression`
- You can adjust multipliers, base values, and simulation logic for your needs

---

## Credits
- System inspired by Glicko-2 and real BedWars ranked progression
- Designed for transparency, realism, and educational value 