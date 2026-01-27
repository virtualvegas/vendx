import { supabase } from "@/integrations/supabase/client";

export interface QuestRewardResult {
  xpEarned: number;
  creditsEarned: number;
  pointsEarned: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Complete a quest and award all rewards to the user
 */
export async function completeQuest(
  userId: string,
  questId: string,
  nodeId: string | null,
  completionId: string
): Promise<QuestRewardResult> {
  // Fetch the quest details
  const { data: quest, error: questError } = await supabase
    .from("quests")
    .select("*")
    .eq("id", questId)
    .single();

  if (questError || !quest) {
    throw new Error("Quest not found");
  }

  const xpReward = quest.xp_reward || 0;
  const creditsReward = Number(quest.credits_reward) || 0;
  const pointsReward = quest.points_reward || 0;

  // Start a transaction-like operation
  // 1. Update quest completion status
  const { error: completionError } = await supabase
    .from("quest_completions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      xp_earned: xpReward,
      credits_earned: creditsReward,
      points_earned: pointsReward,
    })
    .eq("id", completionId);

  if (completionError) {
    throw new Error("Failed to update completion status");
  }

  // 2. Update player progress
  const { data: currentProgress } = await supabase
    .from("quest_player_progress")
    .select("*")
    .eq("user_id", userId)
    .single();

  const previousXp = currentProgress?.total_xp || 0;
  const previousLevel = currentProgress?.current_level || 1;
  const newTotalXp = previousXp + xpReward;
  const newLevel = calculateLevel(newTotalXp);
  const leveledUp = newLevel > previousLevel;

  // Calculate new streak
  const lastQuestDate = currentProgress?.last_quest_date
    ? new Date(currentProgress.last_quest_date)
    : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newStreak = currentProgress?.current_streak || 0;
  if (lastQuestDate) {
    const lastDate = new Date(lastQuestDate);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      newStreak += 1;
    } else if (daysDiff > 1) {
      newStreak = 1; // Reset streak
    }
    // If same day, keep current streak
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, currentProgress?.longest_streak || 0);

  if (currentProgress) {
    await supabase
      .from("quest_player_progress")
      .update({
        total_xp: newTotalXp,
        current_level: newLevel,
        quests_completed: (currentProgress.quests_completed || 0) + 1,
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_quest_date: today.toISOString().split("T")[0],
        total_credits_earned: (Number(currentProgress.total_credits_earned) || 0) + creditsReward,
        total_points_earned: (currentProgress.total_points_earned || 0) + pointsReward,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await supabase.from("quest_player_progress").insert({
      user_id: userId,
      total_xp: xpReward,
      current_level: newLevel,
      quests_completed: 1,
      nodes_discovered: nodeId ? 1 : 0,
      current_streak: 1,
      longest_streak: 1,
      last_quest_date: today.toISOString().split("T")[0],
      total_credits_earned: creditsReward,
      total_points_earned: pointsReward,
    });
  }

  // 3. Update node discovery count if applicable
  if (nodeId) {
    // Check if discovery exists
    const { data: existingDiscovery } = await supabase
      .from("quest_node_discoveries")
      .select("id, visit_count")
      .eq("user_id", userId)
      .eq("node_id", nodeId)
      .single();

    if (existingDiscovery) {
      await supabase
        .from("quest_node_discoveries")
        .update({
          last_visited_at: new Date().toISOString(),
          visit_count: (existingDiscovery.visit_count || 0) + 1,
        })
        .eq("id", existingDiscovery.id);
    } else {
      await supabase.from("quest_node_discoveries").insert({
        user_id: userId,
        node_id: nodeId,
        last_visited_at: new Date().toISOString(),
        visit_count: 1,
      });

      // Update nodes_discovered count
      if (currentProgress) {
        await supabase
          .from("quest_player_progress")
          .update({ nodes_discovered: (currentProgress.nodes_discovered || 0) + 1 })
          .eq("user_id", userId);
      }
    }
  }

  // 4. Increment quest completion count
  await supabase
    .from("quests")
    .update({ current_completions: (quest.current_completions || 0) + 1 })
    .eq("id", questId);

  return {
    xpEarned: xpReward,
    creditsEarned: creditsReward,
    pointsEarned: pointsReward,
    newLevel,
    leveledUp,
  };
}

/**
 * Claim rewards from a completed quest and add to wallet
 */
export async function claimQuestRewards(
  userId: string,
  completionId: string
): Promise<{ credits: number; points: number }> {
  // Get the completion
  const { data: completion, error: completionError } = await supabase
    .from("quest_completions")
    .select("*")
    .eq("id", completionId)
    .eq("user_id", userId)
    .single();

  if (completionError || !completion) {
    throw new Error("Completion not found");
  }

  if (completion.status !== "completed") {
    throw new Error("Quest not yet completed");
  }

  if (completion.claimed_at) {
    throw new Error("Rewards already claimed");
  }

  const creditsEarned = Number(completion.credits_earned) || 0;
  const pointsEarned = completion.points_earned || 0;

  // Update completion as claimed
  await supabase
    .from("quest_completions")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", completionId);

  // Add credits to wallet if any
  if (creditsEarned > 0) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (wallet) {
      await supabase
        .from("wallets")
        .update({ balance: (Number(wallet.balance) || 0) + creditsEarned })
        .eq("user_id", userId);

      // Log transaction
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        amount: creditsEarned,
        transaction_type: "quest_reward",
        description: "Quest reward",
      });
    }
  }

  // Add points if any
  if (pointsEarned > 0) {
    const { data: rewardsPoints } = await supabase
      .from("rewards_points")
      .select("balance, lifetime_points")
      .eq("user_id", userId)
      .single();

    if (rewardsPoints) {
      await supabase
        .from("rewards_points")
        .update({
          balance: (rewardsPoints.balance || 0) + pointsEarned,
          lifetime_points: (rewardsPoints.lifetime_points || 0) + pointsEarned,
        })
        .eq("user_id", userId);

      // Log point transaction
      await supabase.from("point_transactions").insert({
        user_id: userId,
        points: pointsEarned,
        transaction_type: "quest_reward",
        description: "Quest completion reward",
      });
    }
  }

  return { credits: creditsEarned, points: pointsEarned };
}

/**
 * Calculate level from XP using a quadratic formula
 */
export function calculateLevel(xp: number): number {
  // Formula: Level = floor((-1 + sqrt(1 + 8 * xp / 100)) / 2) + 1
  // This gives: Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, Level 4: 600 XP, etc.
  return Math.max(1, Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 100)) / 2) + 1);
}

/**
 * Get XP required for a specific level
 */
export function getXpForLevel(level: number): number {
  return (level * (level + 1) * 50);
}

/**
 * Check if user is within range of a node
 */
export function isWithinRange(
  userLat: number,
  userLng: number,
  nodeLat: number,
  nodeLng: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(userLat, userLng, nodeLat, nodeLng);
  return distance <= radiusMeters;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
