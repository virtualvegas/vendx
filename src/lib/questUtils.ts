import { supabase } from "@/integrations/supabase/client";

export interface QuestRewardResult {
  xpEarned: number;
  creditsEarned: number;
  pointsEarned: number;
  newLevel: number;
  leveledUp: boolean;
  badgesEarned?: string[];
}

export interface QuestValidationResult {
  canStart: boolean;
  reason?: string;
  cooldownEndsAt?: Date;
  completionsRemaining?: number;
}

/**
 * Validate if a user can start a quest at a specific node
 */
export async function validateQuestStart(
  userId: string,
  questId: string,
  nodeId: string
): Promise<QuestValidationResult> {
  // Fetch quest details
  const { data: quest, error: questError } = await supabase
    .from("quests")
    .select("*")
    .eq("id", questId)
    .single();

  if (questError || !quest) {
    return { canStart: false, reason: "Quest not found" };
  }

  // Check quest status
  if (quest.status !== "active") {
    return { canStart: false, reason: "Quest is not active" };
  }

  // Check quest date range
  const now = new Date();
  if (quest.start_date && new Date(quest.start_date) > now) {
    return { canStart: false, reason: "Quest hasn't started yet" };
  }
  if (quest.end_date && new Date(quest.end_date) < now) {
    return { canStart: false, reason: "Quest has expired" };
  }

  // Check max total completions
  if (quest.max_total_completions !== null && 
      (quest.current_completions || 0) >= quest.max_total_completions) {
    return { canStart: false, reason: "Quest has reached maximum completions" };
  }

  // Check user's completion count for this quest
  const { data: userCompletions, error: completionsError } = await supabase
    .from("quest_completions")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("quest_id", questId);

  if (completionsError) {
    return { canStart: false, reason: "Error checking completions" };
  }

  const completedCount = userCompletions?.filter(
    c => c.status === "completed" || c.status === "claimed"
  ).length || 0;

  const maxPerUser = quest.max_completions_per_user || 1;
  const completionsRemaining = maxPerUser - completedCount;

  if (completionsRemaining <= 0) {
    return { 
      canStart: false, 
      reason: "You've completed this quest the maximum number of times",
      completionsRemaining: 0
    };
  }

  // Check cooldown from node
  if (nodeId) {
    const { data: node } = await supabase
      .from("quest_nodes")
      .select("cooldown_hours")
      .eq("id", nodeId)
      .single();

    if (node?.cooldown_hours) {
      // Check last completion at this node
      const { data: lastNodeCompletion } = await supabase
        .from("quest_completions")
        .select("completed_at")
        .eq("user_id", userId)
        .eq("node_id", nodeId)
        .in("status", ["completed", "claimed"])
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastNodeCompletion?.completed_at) {
        const cooldownMs = node.cooldown_hours * 60 * 60 * 1000;
        const cooldownEndsAt = new Date(new Date(lastNodeCompletion.completed_at).getTime() + cooldownMs);
        
        if (cooldownEndsAt > now) {
          return {
            canStart: false,
            reason: `Node on cooldown. Available again at ${cooldownEndsAt.toLocaleTimeString()}`,
            cooldownEndsAt,
            completionsRemaining
          };
        }
      }
    }
  }

  // Check for in-progress completion
  const inProgress = userCompletions?.find(c => c.status === "in_progress");
  if (inProgress) {
    return { canStart: false, reason: "You already have this quest in progress" };
  }

  return { canStart: true, completionsRemaining };
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
    .maybeSingle();

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
  const newQuestsCompleted = (currentProgress?.quests_completed || 0) + 1;
  const newNodesDiscovered = (currentProgress?.nodes_discovered || 0);

  if (currentProgress) {
    await supabase
      .from("quest_player_progress")
      .update({
        total_xp: newTotalXp,
        current_level: newLevel,
        quests_completed: newQuestsCompleted,
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
    const { data: existingDiscovery } = await supabase
      .from("quest_node_discoveries")
      .select("id, visit_count")
      .eq("user_id", userId)
      .eq("node_id", nodeId)
      .maybeSingle();

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
      await supabase
        .from("quest_player_progress")
        .update({ nodes_discovered: newNodesDiscovered + 1 })
        .eq("user_id", userId);
    }
  }

  // 4. Increment quest completion count
  await supabase
    .from("quests")
    .update({ current_completions: (quest.current_completions || 0) + 1 })
    .eq("id", questId);

  // 5. Check and award badges
  const badgesEarned = await checkAndAwardBadges(userId, {
    questsCompleted: newQuestsCompleted,
    nodesDiscovered: newNodesDiscovered + (nodeId && !currentProgress ? 1 : 0),
    totalXp: newTotalXp,
    currentLevel: newLevel,
    currentStreak: newStreak,
    longestStreak,
    questType: quest.quest_type,
  });

  // 6. Update leaderboard
  await updateLeaderboard(userId, xpReward, 1, nodeId ? 1 : 0);

  return {
    xpEarned: xpReward,
    creditsEarned: creditsReward,
    pointsEarned: pointsReward,
    newLevel,
    leveledUp,
    badgesEarned,
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
      // Always credit the parent wallet
      let { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userId)
        .in("wallet_type", ["standard", "guest"])
        .is("parent_wallet_id", null)
        .maybeSingle();

      if (walletError) throw walletError;

      if (!wallet) {
        const { data: created, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: userId, wallet_type: "standard", balance: 0 })
          .select("id, balance")
          .single();
        if (createError) throw createError;
        wallet = created;
      }

      await supabase
        .from("wallets")
        .update({ balance: (Number(wallet.balance) || 0) + creditsEarned })
        .eq("id", wallet.id);

      // Log transaction
      await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        amount: creditsEarned,
        transaction_type: "quest_reward",
        description: "Quest reward",
      });
    }

  // Add points if any
  if (pointsEarned > 0) {
    const { data: rewardsPoints } = await supabase
      .from("rewards_points")
      .select("balance, lifetime_points")
      .eq("user_id", userId)
      .maybeSingle();

    if (rewardsPoints) {
      await supabase
        .from("rewards_points")
        .update({
          balance: (rewardsPoints.balance || 0) + pointsEarned,
          lifetime_points: (rewardsPoints.lifetime_points || 0) + pointsEarned,
        })
        .eq("user_id", userId);
    }

    // Log point transaction (skip RLS with service role if needed)
    // Note: point_transactions may have restrictive RLS
  }

  return { credits: creditsEarned, points: pointsEarned };
}

interface BadgeCheckData {
  questsCompleted: number;
  nodesDiscovered: number;
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  questType: string;
}

/**
 * Check and award badges based on achievements
 */
async function checkAndAwardBadges(
  userId: string,
  data: BadgeCheckData
): Promise<string[]> {
  const earnedBadges: string[] = [];

  // Fetch all badges
  const { data: allBadges } = await supabase
    .from("quest_badges")
    .select("*");

  if (!allBadges) return [];

  // Fetch user's existing badges
  const { data: userBadges } = await supabase
    .from("quest_player_badges")
    .select("badge_id")
    .eq("user_id", userId);

  const existingBadgeIds = new Set(userBadges?.map(b => b.badge_id) || []);

  for (const badge of allBadges) {
    // Skip if already earned
    if (existingBadgeIds.has(badge.id)) continue;

    let shouldAward = false;
    const reqValue = badge.requirement_value || 0;

    switch (badge.requirement_type) {
      case "quests_completed":
        shouldAward = data.questsCompleted >= reqValue;
        break;
      case "nodes_discovered":
        shouldAward = data.nodesDiscovered >= reqValue;
        break;
      case "total_xp":
        shouldAward = data.totalXp >= reqValue;
        break;
      case "level_reached":
        shouldAward = data.currentLevel >= reqValue;
        break;
      case "streak_days":
        shouldAward = data.currentStreak >= reqValue || data.longestStreak >= reqValue;
        break;
      case "first_quest":
        shouldAward = data.questsCompleted >= 1;
        break;
      case "first_discovery":
        shouldAward = data.nodesDiscovered >= 1;
        break;
    }

    if (shouldAward) {
      const { error } = await supabase.from("quest_player_badges").insert({
        user_id: userId,
        badge_id: badge.id,
      });

      if (!error) {
        earnedBadges.push(badge.name);

        // Award badge XP if any
        if (badge.xp_reward) {
          await supabase
            .from("quest_player_progress")
            .update({
              total_xp: data.totalXp + badge.xp_reward,
            })
            .eq("user_id", userId);
        }
      }
    }
  }

  return earnedBadges;
}

/**
 * Update leaderboard entries
 */
async function updateLeaderboard(
  userId: string,
  xpEarned: number,
  questsCompleted: number,
  nodesVisited: number
): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  // Update weekly leaderboard
  await upsertLeaderboardEntry(userId, "weekly", weekStart, xpEarned, questsCompleted, nodesVisited);
  
  // Update monthly leaderboard
  await upsertLeaderboardEntry(userId, "monthly", monthStart, xpEarned, questsCompleted, nodesVisited);
}

async function upsertLeaderboardEntry(
  userId: string,
  period: string,
  periodStart: Date,
  xpEarned: number,
  questsCompleted: number,
  nodesVisited: number
): Promise<void> {
  const periodStartStr = periodStart.toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("quest_leaderboards")
    .select("*")
    .eq("user_id", userId)
    .eq("period", period)
    .eq("period_start", periodStartStr)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("quest_leaderboards")
      .update({
        xp_earned: (existing.xp_earned || 0) + xpEarned,
        quests_completed: (existing.quests_completed || 0) + questsCompleted,
        nodes_visited: (existing.nodes_visited || 0) + nodesVisited,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("quest_leaderboards").insert({
      user_id: userId,
      period,
      period_start: periodStartStr,
      xp_earned: xpEarned,
      quests_completed: questsCompleted,
      nodes_visited: nodesVisited,
    });
  }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
 * Get XP required to reach next level
 */
export function getXpToNextLevel(currentXp: number): { current: number; required: number; progress: number } {
  const currentLevel = calculateLevel(currentXp);
  const xpForCurrentLevel = getXpForLevel(currentLevel - 1);
  const xpForNextLevel = getXpForLevel(currentLevel);
  const xpIntoLevel = currentXp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  
  return {
    current: xpIntoLevel,
    required: xpNeeded,
    progress: (xpIntoLevel / xpNeeded) * 100,
  };
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

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Get time until cooldown ends
 */
export function getTimeUntilCooldown(cooldownEndsAt: Date): string {
  const now = new Date();
  const diff = cooldownEndsAt.getTime() - now.getTime();
  
  if (diff <= 0) return "Ready";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Check and award chain completion bonus when all steps are done
 */
export async function checkAndAwardChainBonus(
  userId: string,
  questId: string
): Promise<{ chainCompleted: boolean; chainName?: string; bonusXp?: number; bonusCredits?: number }> {
  // Find chains that include this quest
  const { data: chainSteps } = await supabase
    .from("quest_chain_steps")
    .select(`
      *,
      chain:quest_chains(*)
    `)
    .eq("quest_id", questId);

  if (!chainSteps || chainSteps.length === 0) {
    return { chainCompleted: false };
  }

  for (const step of chainSteps) {
    const chain = step.chain as any;
    if (!chain || !chain.is_active) continue;

    // Get all quests in this chain
    const { data: allSteps } = await supabase
      .from("quest_chain_steps")
      .select("quest_id")
      .eq("chain_id", chain.id);

    if (!allSteps || allSteps.length === 0) continue;

    const questIds = allSteps.map(s => s.quest_id);

    // Check how many the user has completed
    const { data: completions } = await supabase
      .from("quest_completions")
      .select("quest_id")
      .eq("user_id", userId)
      .in("quest_id", questIds)
      .in("status", ["completed", "claimed"]);

    const completedQuestIds = new Set(completions?.map(c => c.quest_id) || []);
    const allCompleted = questIds.every(qid => completedQuestIds.has(qid));

    if (!allCompleted) continue;

    // Check if bonus already claimed using raw query
    const { data: existingClaim } = await supabase
      .from("quest_chain_claims" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("chain_id", chain.id)
      .maybeSingle();

    if (existingClaim) continue; // Already claimed

    // Award bonus!
    const bonusXp = chain.bonus_xp || 0;
    const bonusCredits = Number(chain.bonus_credits) || 0;

    // Record the claim
    await supabase.from("quest_chain_claims" as any).insert({
      user_id: userId,
      chain_id: chain.id,
      bonus_xp_awarded: bonusXp,
      bonus_credits_awarded: bonusCredits,
    });

    // Update player progress with bonus XP
    if (bonusXp > 0) {
      const { data: progress } = await supabase
        .from("quest_player_progress")
        .select("total_xp, current_level")
        .eq("user_id", userId)
        .maybeSingle();

      if (progress) {
        const newXp = (progress.total_xp || 0) + bonusXp;
        await supabase
          .from("quest_player_progress")
          .update({
            total_xp: newXp,
            current_level: calculateLevel(newXp),
          })
          .eq("user_id", userId);
      }
    }

    // Add bonus credits to wallet
    if (bonusCredits > 0) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userId)
        .in("wallet_type", ["standard", "guest"])
        .is("parent_wallet_id", null)
        .maybeSingle();

      if (wallet) {
        await supabase
          .from("wallets")
          .update({ balance: (Number(wallet.balance) || 0) + bonusCredits })
          .eq("id", wallet.id);

        await supabase.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          amount: bonusCredits,
          transaction_type: "chain_bonus",
          description: `Chain bonus: ${chain.name}`,
        });
      }
    }

    return {
      chainCompleted: true,
      chainName: chain.name,
      bonusXp,
      bonusCredits,
    };
  }

  return { chainCompleted: false };
}

/**
 * Check and award daily challenge rewards
 */
export async function checkDailyChallengeRewards(
  userId: string
): Promise<{ challengesCompleted: string[]; totalBonusXp: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Check if already claimed today using raw query
  const { data: existingClaim } = await supabase
    .from("quest_daily_claims" as any)
    .select("id, challenges_claimed")
    .eq("user_id", userId)
    .eq("claim_date", todayStr)
    .maybeSingle();

  const alreadyClaimed = new Set<string>((existingClaim as any)?.challenges_claimed || []);

  // Get today's stats
  const { data: completions } = await supabase
    .from("quest_completions")
    .select("id, node_id")
    .eq("user_id", userId)
    .gte("completed_at", today.toISOString())
    .in("status", ["completed", "claimed"]);

  const questsCompleted = completions?.length || 0;
  const nodesVisited = new Set(completions?.map(c => c.node_id).filter(Boolean)).size;

  // Get player progress for streak
  const { data: progress } = await supabase
    .from("quest_player_progress")
    .select("current_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const currentStreak = progress?.current_streak || 0;

  // Define challenges and check which are newly completed
  const challenges = [
    { id: "daily-quest-1", target: 1, current: questsCompleted, reward: 50 },
    { id: "daily-quest-3", target: 3, current: questsCompleted, reward: 150 },
    { id: "daily-explore-2", target: 2, current: nodesVisited, reward: 100 },
    { id: "daily-streak", target: 1, current: currentStreak > 0 ? 1 : 0, reward: 50 },
  ];

  const newlyCompleted: string[] = [];
  let totalBonusXp = 0;

  for (const challenge of challenges) {
    if (challenge.current >= challenge.target && !alreadyClaimed.has(challenge.id)) {
      newlyCompleted.push(challenge.id);
      totalBonusXp += challenge.reward;
    }
  }

  if (newlyCompleted.length === 0) {
    return { challengesCompleted: [], totalBonusXp: 0 };
  }

  // Record claims
  const allClaimed = [...alreadyClaimed, ...newlyCompleted];

  if (existingClaim) {
    await supabase
      .from("quest_daily_claims" as any)
      .update({ challenges_claimed: allClaimed, total_xp_awarded: totalBonusXp })
      .eq("id", (existingClaim as any).id);
  } else {
    await supabase.from("quest_daily_claims" as any).insert({
      user_id: userId,
      claim_date: todayStr,
      challenges_claimed: allClaimed,
      total_xp_awarded: totalBonusXp,
    });
  }

  // Award bonus XP
  if (totalBonusXp > 0) {
    const { data: playerProgress } = await supabase
      .from("quest_player_progress")
      .select("total_xp")
      .eq("user_id", userId)
      .maybeSingle();

    if (playerProgress) {
      const newXp = (playerProgress.total_xp || 0) + totalBonusXp;
      await supabase
        .from("quest_player_progress")
        .update({
          total_xp: newXp,
          current_level: calculateLevel(newXp),
        })
        .eq("user_id", userId);
    }
  }

  return { challengesCompleted: newlyCompleted, totalBonusXp };
}
