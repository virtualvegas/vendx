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
  // Rewards are computed and applied server-side (players cannot self-report them)
  const { data, error } = await supabase.rpc("quest_finalize_completion" as any, {
    p_completion_id: completionId,
  } as any);

  if (error) throw new Error(error.message || "Failed to complete quest");

  const result: any = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Failed to complete quest");

  const xpReward = result.xp_earned || 0;
  const creditsReward = Number(result.credits_earned) || 0;
  const pointsReward = result.points_earned || 0;
  const newLevel = result.new_level || 1;
  const leveledUp = !!result.leveled_up;

  const { data: quest } = await supabase
    .from("quests")
    .select("quest_type")
    .eq("id", questId)
    .maybeSingle();

  const { data: progress } = await supabase
    .from("quest_player_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const badgesEarned = await checkAndAwardBadges(userId, {
    questsCompleted: progress?.quests_completed || 0,
    nodesDiscovered: progress?.nodes_discovered || 0,
    totalXp: progress?.total_xp || 0,
    currentLevel: newLevel,
    currentStreak: progress?.current_streak || 0,
    longestStreak: progress?.longest_streak || 0,
    questType: quest?.quest_type || "free",
  });

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

      // Log credit via guarded RPC (direct credit inserts are blocked)
      await supabase.rpc("wallet_log_credit" as any, {
        p_wallet_id: wallet.id,
        p_amount: creditsEarned,
        p_type: "quest_reward",
        p_description: "Quest reward",
      } as any);
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
    .select("chain_id")
    .eq("quest_id", questId);

  for (const step of chainSteps || []) {
    // Server validates completion of every step before awarding anything
    const { data, error } = await supabase.rpc("quest_claim_chain_bonus" as any, {
      p_chain_id: step.chain_id,
    } as any);

    if (error) continue;

    const r: any = Array.isArray(data) ? data[0] : data;
    if (r?.awarded) {
      return {
        chainCompleted: true,
        chainName: r.chain_name,
        bonusXp: r.bonus_xp || 0,
        bonusCredits: Number(r.bonus_credits) || 0,
      };
    }
  }

  return { chainCompleted: false };
}

/**
 * Check and award daily challenge rewards
 */
export async function checkDailyChallengeRewards(
  _userId: string
): Promise<{ challengesCompleted: string[]; totalBonusXp: number }> {
  // Server recomputes today's progress and awards the XP itself
  const { data, error } = await supabase.rpc("quest_claim_daily_challenges" as any);

  if (error) return { challengesCompleted: [], totalBonusXp: 0 };

  const r: any = Array.isArray(data) ? data[0] : data;
  return {
    challengesCompleted: r?.challenges_completed || [],
    totalBonusXp: r?.total_bonus_xp || 0,
  };
}
