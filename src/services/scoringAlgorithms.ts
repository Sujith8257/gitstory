/**
 * Scoring and calculation algorithms for GitStory
 * All scoring logic is centralized here for easy modification
 */

// ============================================
// CONFIGURATION - Easy to tune
// ============================================
export const SCORING_CONFIG = {
  // Language scoring weights
  language: {
    baseWeight: 1,           // Each repo counts as 1
    recentActivityBonus: 1,  // Extra point for 2025 activity
    diversityThreshold: 3,   // Minimum repos to get diversity bonus
    diversityBonus: 0.5,     // Bonus per repo above threshold
  },

  // Repository scoring weights
  repo: {
    stars: {
      maxPoints: 30,
      logMultiplier: 10,
    },
    forks: {
      maxPoints: 15,
      logMultiplier: 5,
    },
    recency: {
      maxPoints: 25,
      decayDays: 15,  // Points decay over this many days
    },
    originalWork: 15,     // Bonus for non-fork
    hasDescription: 5,    // Bonus for having description
    hasTopics: 5,         // Bonus for having topics
    hasLanguage: 3,       // Bonus for having a language
    watchersMultiplier: 0.5,
    watchersMax: 5,
    archivedPenalty: -20,
    sizeLogMultiplier: 3,
    sizeMaxPoints: 15,
    openIssuesLogMultiplier: 4,
    openIssuesMaxPoints: 8,
    createdIn2025Bonus: 10,
  }
};

// ============================================
// LANGUAGE SCORING
// ============================================

interface LanguageScore {
  name: string;
  weight: number;
  repoCount: number;
  recentCount: number;
}

/**
 * Calculate language weights from repositories
 * - Excludes forks (they don't represent user's own code)
 * - Weights recent activity higher (2025 repos count more)
 * - Diversity bonus: languages with 3+ repos get extra weight
 */
export function calculateLanguageScores(repos: any[]): Map<string, LanguageScore> {
  const langMap = new Map<string, LanguageScore>();
  const year2025 = new Date('2025-01-01');
  const { baseWeight, recentActivityBonus, diversityThreshold, diversityBonus } = SCORING_CONFIG.language;

  // First pass: count repos per language
  repos.forEach((repo) => {
    // Skip forks - they don't represent user's own work
    if (repo.fork) return;

    // Skip repos without a language
    if (!repo.language) return;

    const lang = repo.language;
    const pushedAt = new Date(repo.pushed_at);
    const isActiveIn2025 = pushedAt >= year2025;

    // Initialize if not exists
    if (!langMap.has(lang)) {
      langMap.set(lang, {
        name: lang,
        weight: 0,
        repoCount: 0,
        recentCount: 0,
      });
    }

    const score = langMap.get(lang)!;
    score.repoCount++;

    if (isActiveIn2025) {
      score.recentCount++;
    }

    // Base weight + recent activity bonus
    score.weight += baseWeight + (isActiveIn2025 ? recentActivityBonus : 0);
  });

  // Second pass: apply diversity bonus for languages with many repos
  // This rewards consistent use of a language across multiple projects
  langMap.forEach((score) => {
    if (score.repoCount >= diversityThreshold) {
      const extraRepos = score.repoCount - diversityThreshold;
      score.weight += extraRepos * diversityBonus;
    }
  });

  return langMap;
}

/**
 * Get top N languages sorted by weight
 */
export function getTopLanguages(langMap: Map<string, LanguageScore>, topN: number = 3): LanguageScore[] {
  return Array.from(langMap.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

// ============================================
// REPOSITORY SCORING
// ============================================

/**
 * Calculate a comprehensive score for a repository
 * Higher score = more interesting/important project
 */
export function calculateRepoScore(repo: any): number {
  let score = 0;
  const config = SCORING_CONFIG.repo;
  const now = new Date();
  const year2025Start = new Date('2025-01-01');

  // 1. Stars (logarithmic scale)
  score += Math.min(
    Math.log10(repo.stargazers_count + 1) * config.stars.logMultiplier,
    config.stars.maxPoints
  );

  // 2. Forks (logarithmic scale)
  score += Math.min(
    Math.log10(repo.forks_count + 1) * config.forks.logMultiplier,
    config.forks.maxPoints
  );

  // 3. Recency - repos pushed in 2025 get priority
  const pushedAt = new Date(repo.pushed_at);
  if (pushedAt >= year2025Start) {
    const daysSincePush = Math.max(0, (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24));
    score += Math.max(0, config.recency.maxPoints - (daysSincePush / config.recency.decayDays));
  }

  // 4. Original work bonus (not a fork)
  if (!repo.fork) {
    score += config.originalWork;
  }

  // 5. Has description
  if (repo.description && repo.description.trim().length > 10) {
    score += config.hasDescription;
  }

  // 6. Has topics/tags
  if (repo.topics && repo.topics.length > 0) {
    score += config.hasTopics;
  }

  // 7. Has a primary language
  if (repo.language) {
    score += config.hasLanguage;
  }

  // 8. Watchers
  score += Math.min(repo.watchers_count * config.watchersMultiplier, config.watchersMax);

  // 9. Archived penalty
  if (repo.archived) {
    score += config.archivedPenalty;
  }

  // 10. Repo size (proxy for code volume)
  if (repo.size > 0) {
    score += Math.min(
      Math.log10(repo.size) * config.sizeLogMultiplier,
      config.sizeMaxPoints
    );
  }

  // 11. Open issues (activity indicator)
  if (repo.open_issues_count > 0) {
    score += Math.min(
      Math.log10(repo.open_issues_count + 1) * config.openIssuesLogMultiplier,
      config.openIssuesMaxPoints
    );
  }

  // 12. Created in 2025
  const createdAt = new Date(repo.created_at);
  if (createdAt >= year2025Start) {
    score += config.createdIn2025Bonus;
  }

  return score;
}

// ============================================
// ARCHETYPE CALCULATION
// ============================================

import { ContributionBreakdown, CommunityStats } from '../types';

/**
 * Determine user's coding archetype based on behavior patterns
 */
export function calculateArchetype(
  breakdown: ContributionBreakdown,
  community: CommunityStats,
  totalCommits: number,
  productivity: { peakHour: number },
  weekdayStats: number[]
): string {
  const totalActivity = breakdown.commits + breakdown.prs + breakdown.issues + breakdown.reviews;

  // Calculate percentages
  const prPercentage = totalActivity > 0 ? (breakdown.prs / totalActivity) * 100 : 0;
  const reviewPercentage = totalActivity > 0 ? (breakdown.reviews / totalActivity) * 100 : 0;
  const issuePercentage = totalActivity > 0 ? (breakdown.issues / totalActivity) * 100 : 0;

  // Weekend activity
  const weekendCommits = weekdayStats[0] + weekdayStats[6]; // Sunday + Saturday
  const totalWeekCommits = weekdayStats.reduce((a, b) => a + b, 0);
  const weekendPercentage = totalWeekCommits > 0 ? (weekendCommits / totalWeekCommits) * 100 : 0;

  // Determine archetype based on patterns
  if (prPercentage > 20) return "The Collaboration Maestro";
  if (reviewPercentage > 10) return "The Quality Guardian";
  if (productivity.peakHour >= 22 || productivity.peakHour <= 4) return "The Midnight Architect";
  if (productivity.peakHour >= 5 && productivity.peakHour <= 11) return "The Dawn Coder";
  if (weekendPercentage > 35) return "The Passion Programmer";
  if (totalCommits >= 1200) return "The Relentless Builder";
  if (totalCommits >= 400) return "The Steady Craftsman";
  if (issuePercentage > 15) return "The Visionary Planner";
  if (community.followers >= 500 || community.totalStars >= 1000) return "The Open Source Star";

  return "The Curious Explorer";
}

// ============================================
// PRODUCTIVITY CALCULATION
// ============================================

/**
 * Determine peak coding hours and time-of-day persona
 */
export function calculateProductivity(hourCounts: Record<number, number>): {
  timeOfDay: string;
  peakHour: number;
} {
  let peakHour = 14; // Default to afternoon
  let maxCount = 0;

  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hour);
    }
  }

  let timeOfDay: string;
  if (peakHour >= 5 && peakHour < 12) {
    timeOfDay = "Morning";
  } else if (peakHour >= 12 && peakHour < 17) {
    timeOfDay = "Afternoon";
  } else if (peakHour >= 17 && peakHour < 21) {
    timeOfDay = "Evening";
  } else {
    timeOfDay = "Late Night";
  }

  return { timeOfDay, peakHour };
}

// ============================================
// BADGES CALCULATION
// ============================================

/**
 * Calculate total badges earned based on various achievements
 * Each achievement category can award multiple badges
 */
export function calculateBadges(
  breakdown: ContributionBreakdown,
  community: CommunityStats,
  totalCommits: number,
  longestStreak: number,
  publicRepos: number
): number {
  // Use getEarnedBadges to get the actual list and return its length
  // This ensures the count matches exactly what badges are displayed
  const badges = getEarnedBadges(breakdown, community, totalCommits, longestStreak, publicRepos);
  return badges.length;
}

/**
 * Get the list of specific badges earned by the user
 */
export interface Badge {
  name: string;
  category: string;
  icon: string; // Icon name for lucide-react
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Get actual GitHub Achievements earned by the user
 * Based on: https://github.com/drknzz/GitHub-Achievements
 */
export function getGitHubAchievements(
  breakdown: ContributionBreakdown,
  community: CommunityStats,
  totalCommits: number,
  longestStreak: number,
  publicRepos: number,
  topRepos: { stars: number }[]
): Badge[] {
  const achievements: Badge[] = [];

  // Starstruck - Created a repository that has 16+ stars
  const hasStarstruck = (topRepos || []).some(repo => (repo?.stars || 0) >= 16);
  if (hasStarstruck) {
    achievements.push({ 
      name: "Starstruck", 
      category: "Repository", 
      icon: "Star", 
      color: "text-yellow-500", 
      bgColor: "bg-yellow-500/10", 
      borderColor: "border-yellow-500/20" 
    });
  }

  // Pull Shark - Merged 2+ pull requests
  if (breakdown.prs >= 2) {
    achievements.push({ 
      name: "Pull Shark", 
      category: "Collaboration", 
      icon: "GitPullRequest", 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10", 
      borderColor: "border-blue-500/20" 
    });
  }

  // Galaxy Brain - Answered a discussion (we estimate based on issues/PRs)
  // Since we don't have discussion data, we'll estimate based on high engagement
  if (breakdown.issues >= 5 || breakdown.reviews >= 10) {
    achievements.push({ 
      name: "Galaxy Brain", 
      category: "Community", 
      icon: "Lightbulb", 
      color: "text-purple-500", 
      bgColor: "bg-purple-500/10", 
      borderColor: "border-purple-500/20" 
    });
  }

  // Quickdraw - Merged PR within 5 minutes (we estimate based on PR activity)
  // Since we don't have PR merge time data, we'll award if user has many PRs
  if (breakdown.prs >= 10) {
    achievements.push({ 
      name: "Quickdraw", 
      category: "Speed", 
      icon: "Zap", 
      color: "text-orange-500", 
      bgColor: "bg-orange-500/10", 
      borderColor: "border-orange-500/20" 
    });
  }

  // Pair Extraordinaire - Co-authored commits (we estimate based on collaboration)
  if (breakdown.prs >= 5 && breakdown.reviews >= 5) {
    achievements.push({ 
      name: "Pair Extraordinaire", 
      category: "Collaboration", 
      icon: "Users", 
      color: "text-cyan-500", 
      bgColor: "bg-cyan-500/10", 
      borderColor: "border-cyan-500/20" 
    });
  }

  // YOLO - Merged PR without review (we estimate based on PR count)
  // Since we don't have review data per PR, we'll award if user has many PRs
  if (breakdown.prs >= 20) {
    achievements.push({ 
      name: "YOLO", 
      category: "Risk", 
      icon: "Rocket", 
      color: "text-red-500", 
      bgColor: "bg-red-500/10", 
      borderColor: "border-red-500/20" 
    });
  }

  // Heart On Your Sleeve - Reacted to issues/PRs (we estimate based on engagement)
  if (breakdown.issues >= 3 || breakdown.reviews >= 5) {
    achievements.push({ 
      name: "Heart On Your Sleeve", 
      category: "Engagement", 
      icon: "Heart", 
      color: "text-pink-500", 
      bgColor: "bg-pink-500/10", 
      borderColor: "border-pink-500/20" 
    });
  }

  // Open Sourcerer - Contributed to open source (we estimate based on public repos)
  if (publicRepos >= 5 || (breakdown.prs >= 3 && publicRepos >= 1)) {
    achievements.push({ 
      name: "Open Sourcerer", 
      category: "Open Source", 
      icon: "Sparkles", 
      color: "text-indigo-500", 
      bgColor: "bg-indigo-500/10", 
      borderColor: "border-indigo-500/20" 
    });
  }

  return achievements;
}

export function getEarnedBadges(
  breakdown: ContributionBreakdown,
  community: CommunityStats,
  totalCommits: number,
  longestStreak: number,
  publicRepos: number
): Badge[] {
  const badges: Badge[] = [];

  // Commit badges - only highest tier
  if (totalCommits >= 2000) {
    badges.push({ name: "Master Committer", category: "Commits", icon: "🏆", color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" });
  } else if (totalCommits >= 1000) {
    badges.push({ name: "Heavy Committer", category: "Commits", icon: "💪", color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" });
  } else if (totalCommits >= 500) {
    badges.push({ name: "Active Committer", category: "Commits", icon: "⚡", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" });
  } else if (totalCommits >= 200) {
    badges.push({ name: "Regular Contributor", category: "Commits", icon: "📝", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" });
  }

  // Streak badges - only highest tier
  if (longestStreak >= 100) {
    badges.push({ name: "Streak Legend", category: "Consistency", icon: "🔥", color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" });
  } else if (longestStreak >= 50) {
    badges.push({ name: "Streak Master", category: "Consistency", icon: "⭐", color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" });
  } else if (longestStreak >= 30) {
    badges.push({ name: "Streak Champion", category: "Consistency", icon: "🏅", color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" });
  } else if (longestStreak >= 15) {
    badges.push({ name: "Consistent Coder", category: "Consistency", icon: "📅", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" });
  }

  // PR badges - only highest tier
  if (breakdown.prs >= 100) {
    badges.push({ name: "PR Powerhouse", category: "Collaboration", icon: "🚀", color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" });
  } else if (breakdown.prs >= 50) {
    badges.push({ name: "PR Pro", category: "Collaboration", icon: "💼", color: "text-indigo-500", bgColor: "bg-indigo-500/10", borderColor: "border-indigo-500/20" });
  } else if (breakdown.prs >= 20) {
    badges.push({ name: "Collaborator", category: "Collaboration", icon: "🤝", color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" });
  }

  // Review badges - only highest tier
  if (breakdown.reviews >= 50) {
    badges.push({ name: "Code Reviewer", category: "Quality", icon: "👁️", color: "text-pink-500", bgColor: "bg-pink-500/10", borderColor: "border-pink-500/20" });
  } else if (breakdown.reviews >= 20) {
    badges.push({ name: "Quality Guardian", category: "Quality", icon: "🛡️", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" });
  }

  // Issue badges - only highest tier
  if (breakdown.issues >= 30) {
    badges.push({ name: "Issue Solver", category: "Problem Solving", icon: "🔧", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" });
  } else if (breakdown.issues >= 10) {
    badges.push({ name: "Problem Reporter", category: "Problem Solving", icon: "📋", color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" });
  }

  // Community badges - stars
  if (community.totalStars >= 500) {
    badges.push({ name: "Star Magnet", category: "Community", icon: "⭐", color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" });
  } else if (community.totalStars >= 100) {
    badges.push({ name: "Popular Repo", category: "Community", icon: "🌟", color: "text-orange-500", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" });
  }

  // Community badges - followers
  if (community.followers >= 200) {
    badges.push({ name: "Community Leader", category: "Community", icon: "👑", color: "text-purple-500", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" });
  } else if (community.followers >= 50) {
    badges.push({ name: "Growing Influence", category: "Community", icon: "📈", color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" });
  }

  // Repository badges - only highest tier
  if (publicRepos >= 50) {
    badges.push({ name: "Repo Collector", category: "Projects", icon: "📦", color: "text-indigo-500", bgColor: "bg-indigo-500/10", borderColor: "border-indigo-500/20" });
  } else if (publicRepos >= 20) {
    badges.push({ name: "Multi-Project", category: "Projects", icon: "🗂️", color: "text-cyan-500", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/20" });
  } else if (publicRepos >= 10) {
    badges.push({ name: "Project Starter", category: "Projects", icon: "🚀", color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" });
  }

  // Balanced contributor badge
  const hasCommits = breakdown.commits > 0;
  const hasPRs = breakdown.prs > 0;
  const hasReviews = breakdown.reviews > 0;
  const hasIssues = breakdown.issues > 0;
  if (hasCommits && hasPRs && hasReviews && hasIssues) {
    badges.push({ name: "Well-Rounded Developer", category: "Overall", icon: "🎯", color: "text-violet-500", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/20" });
  }

  return badges;
}

// ============================================
// GRADE CALCULATION
// ============================================

/**
 * Calculate overall grade based on comprehensive performance metrics
 * Grade scale: F, D, C, B, A, A+
 */
export function calculateGrade(
  breakdown: ContributionBreakdown,
  community: CommunityStats,
  totalCommits: number,
  longestStreak: number,
  publicRepos: number
): string {
  let score = 0;

  // Commits (30 points max)
  if (totalCommits >= 2000) score += 30;
  else if (totalCommits >= 1000) score += 25;
  else if (totalCommits >= 500) score += 20;
  else if (totalCommits >= 200) score += 15;
  else if (totalCommits >= 100) score += 10;
  else if (totalCommits >= 50) score += 5;

  // Streak (20 points max)
  if (longestStreak >= 100) score += 20;
  else if (longestStreak >= 50) score += 15;
  else if (longestStreak >= 30) score += 12;
  else if (longestStreak >= 15) score += 8;
  else if (longestStreak >= 7) score += 5;

  // PRs (15 points max)
  if (breakdown.prs >= 100) score += 15;
  else if (breakdown.prs >= 50) score += 12;
  else if (breakdown.prs >= 20) score += 9;
  else if (breakdown.prs >= 10) score += 6;
  else if (breakdown.prs >= 5) score += 3;

  // Reviews (10 points max)
  if (breakdown.reviews >= 50) score += 10;
  else if (breakdown.reviews >= 20) score += 8;
  else if (breakdown.reviews >= 10) score += 5;
  else if (breakdown.reviews >= 5) score += 3;

  // Issues (5 points max)
  if (breakdown.issues >= 30) score += 5;
  else if (breakdown.issues >= 10) score += 3;
  else if (breakdown.issues >= 5) score += 2;

  // Community engagement (10 points max)
  const communityScore = Math.min(
    (community.followers / 10) + (community.totalStars / 50),
    10
  );
  score += communityScore;

  // Repository diversity (10 points max)
  if (publicRepos >= 50) score += 10;
  else if (publicRepos >= 20) score += 7;
  else if (publicRepos >= 10) score += 5;
  else if (publicRepos >= 5) score += 3;
  else if (publicRepos >= 1) score += 1;

  // Determine grade
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}