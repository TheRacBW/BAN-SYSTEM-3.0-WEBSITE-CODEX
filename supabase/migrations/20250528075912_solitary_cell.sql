-- Update rank images with correct URLs
UPDATE account_ranks
SET image_url = CASE name
  WHEN 'Bronze' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/5/5a/Bronze_Rank_Icon.png'
  WHEN 'Silver' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/6/64/Silver_Rank_Icon.png'
  WHEN 'Gold' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/9/92/Gold_Rank_Icon.png'
  WHEN 'Platinum' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/0/08/Platinum_Rank_Icon.png'
  WHEN 'Diamond' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/c/cb/Diamond_Rank_Icon.png'
  WHEN 'Emerald' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/0/06/Emerald_Rank_Icon.png'
  WHEN 'Nightmare' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/7/76/Nightmare_Rank_Icon.png'
END
WHERE name IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald', 'Nightmare');