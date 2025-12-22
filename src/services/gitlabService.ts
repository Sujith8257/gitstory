import {
  GitStoryData,
  Language,
  Repository,
  ContributionBreakdown,
  CommunityStats,
} from "@/types";
import { MOCK_DATA } from "@/lib/constants";
import {
  calculateLanguageScores,
  getTopLanguages,
  calculateRepoScore,
  calculateArchetype,
  calculateProductivity,
} from "@/services/scoringAlgorithms";

const GITLAB_API_BASE = "https://gitlab.com/api/v4";

// Extended language color palette (same as GitHub)
const langColors: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  SCSS: "#c6538c",
  Less: "#1d365d",
  Astro: "#ff5a03",
  MDX: "#1b1f24",
  Rust: "#dea584",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Go: "#00ADD8",
  Zig: "#f7a41d",
  Assembly: "#6E4C13",
  "Objective-C": "#438eff",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Scala: "#c22d40",
  Groovy: "#4298b8",
  Clojure: "#db5855",
  Python: "#3572A5",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Perl: "#0298c3",
  Lua: "#000080",
  R: "#198CE7",
  Julia: "#a270ba",
  Elixir: "#6e4a7e",
  Erlang: "#B83998",
  Haskell: "#5e5086",
  OCaml: "#3be133",
  Swift: "#F05138",
  Dart: "#00B4AB",
  "Objective-C++": "#6866fb",
  "Jupyter Notebook": "#DA5B0B",
  MATLAB: "#e16737",
  SAS: "#B34936",
  Shell: "#89e051",
  PowerShell: "#012456",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Nix: "#7e7eff",
  HCL: "#844fba",
  SQL: "#e38c00",
  PLpgSQL: "#336790",
  TSQL: "#e38c00",
  GraphQL: "#e10098",
  Markdown: "#083fa1",
  TeX: "#3D6117",
  Org: "#77aa99",
  "F#": "#b845fc",
  Crystal: "#000100",
  Nim: "#ffc200",
  V: "#4f87c4",
  Solidity: "#AA6746",
  Move: "#4a137a",
  Cairo: "#ff4c00",
  WASM: "#654ff0",
  WebAssembly: "#654ff0",
  CoffeeScript: "#244776",
  Elm: "#60B5CC",
  PureScript: "#1D222D",
  ReasonML: "#ff5847",
  Raku: "#0000fb",
  Fortran: "#4d41b1",
  COBOL: "#005ca5",
  Ada: "#02f88c",
  D: "#ba595e",
  Vala: "#a56de2",
  Hack: "#878787",
  ActionScript: "#882B0F",
};

interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
  created_at: string;
  followers: number;
  following: number;
}

interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path: string;
  description: string | null;
  star_count: number;
  forks_count: number;
  created_at: string;
  last_activity_at: string;
  web_url: string;
  topics: string[];
  languages?: Record<string, number>;
}

interface GitLabEvent {
  id: number;
  action_name: string;
  created_at: string;
  target_type: string | null;
  push_data?: {
    commit_count: number;
    action: string;
    ref_type: string;
  };
}

// Fetch GitLab user data
const fetchGitLabUser = async (
  username: string,
  headers: HeadersInit
): Promise<GitLabUser | null> => {
  const userRes = await fetch(`${GITLAB_API_BASE}/users?username=${username}`, {
    headers,
  });
  if (!userRes.ok) return null;

  const users = await userRes.json();
  if (!users || users.length === 0) return null;

  // Get full user data with followers/following
  const userDetailRes = await fetch(`${GITLAB_API_BASE}/users/${users[0].id}`, {
    headers,
  });
  if (!userDetailRes.ok) return users[0];

  return userDetailRes.json();
};

// Fetch user's projects
const fetchGitLabProjects = async (
  userId: number,
  headers: HeadersInit
): Promise<GitLabProject[]> => {
  const projects: GitLabProject[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `${GITLAB_API_BASE}/users/${userId}/projects?per_page=${perPage}&page=${page}&order_by=updated_at&sort=desc`,
      { headers }
    );

    if (!res.ok) break;

    const batch = await res.json();
    if (batch.length === 0) break;

    projects.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return projects;
};

// Fetch user's contribution events
const fetchGitLabEvents = async (
  username: string,
  headers: HeadersInit
): Promise<GitLabEvent[]> => {
  const events: GitLabEvent[] = [];
  const year = 2025;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let page = 1;
  const perPage = 100;

  // GitLab events API has a max of 100 per page
  while (page <= 10) {
    // Limit to 1000 events max
    const res = await fetch(
      `${GITLAB_API_BASE}/users/${username}/events?per_page=${perPage}&page=${page}&after=${startDate}&before=${endDate}`,
      { headers }
    );

    if (!res.ok) break;

    const batch = await res.json();
    if (batch.length === 0) break;

    events.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return events;
};

// Process events into daily contributions
const processEventsToContributions = (
  events: GitLabEvent[]
): { date: string; count: number }[] => {
  const dailyCounts: Record<string, number> = {};

  // Initialize all days of 2025
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-12-31");
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dailyCounts[d.toISOString().split("T")[0]] = 0;
  }

  // Count contributions from events
  events.forEach((event) => {
    const date = new Date(event.created_at).toISOString().split("T")[0];
    if (dailyCounts.hasOwnProperty(date)) {
      // Push events with commits count more
      if (event.push_data?.commit_count) {
        dailyCounts[date] += event.push_data.commit_count;
      } else {
        dailyCounts[date] += 1;
      }
    }
  });

  return Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// Calculate contribution breakdown from events
const calculateContributionBreakdown = (
  events: GitLabEvent[]
): ContributionBreakdown => {
  let commits = 0;
  let prs = 0; // Merge requests in GitLab
  let issues = 0;
  let reviews = 0;

  events.forEach((event) => {
    if (event.push_data?.commit_count) {
      commits += event.push_data.commit_count;
    } else if (
      event.action_name === "pushed to" ||
      event.action_name === "pushed new"
    ) {
      commits += 1;
    } else if (event.target_type === "MergeRequest") {
      if (event.action_name === "opened" || event.action_name === "created") {
        prs++;
      } else if (
        event.action_name === "accepted" ||
        event.action_name === "approved"
      ) {
        reviews++;
      }
    } else if (event.target_type === "Issue") {
      issues++;
    }
  });

  return { commits, prs, issues, reviews };
};

export const fetchGitLabUserStory = async (
  username: string,
  token?: string
): Promise<GitStoryData> => {
  if (username.toLowerCase() === "demo") {
    return new Promise((resolve) => setTimeout(() => resolve(MOCK_DATA), 1500));
  }

  // Create headers with optional auth token
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    // 1. Fetch user info
    const user = await fetchGitLabUser(username, headers);

    if (!user) {
      throw new Error(
        `User "${username}" not found on GitLab. Check the spelling and try again.`
      );
    }

    // 2. Fetch projects and events in parallel
    const [projects, events] = await Promise.all([
      fetchGitLabProjects(user.id, headers),
      fetchGitLabEvents(username, headers),
    ]);

    // 3. Process contributions
    const contributions = processEventsToContributions(events);
    const contributionBreakdown = calculateContributionBreakdown(events);

    // 4. Process velocity data
    const velocityData: { date: string; commits: number }[] = [];
    let totalCommits = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    const weekdayStats = [0, 0, 0, 0, 0, 0, 0];

    contributions.forEach((day) => {
      const count = day.count || 0;
      totalCommits += count;

      const dateObj = new Date(day.date);
      velocityData.push({
        date: dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        commits: count,
      });

      if (count > 0) weekdayStats[dateObj.getDay()] += count;

      if (count > 0) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    });

    const days = [
      "Sundays",
      "Mondays",
      "Tuesdays",
      "Wednesdays",
      "Thursdays",
      "Fridays",
      "Saturdays",
    ];
    const maxDayIndex = weekdayStats.indexOf(Math.max(...weekdayStats));
    const busiestDay = days[maxDayIndex];

    // 5. Process languages from projects
    const langMap = new Map<string, { weight: number; repoCount: number }>();
    let totalStars = 0;

    // Score projects and collect language data
    const projectScores: { project: GitLabProject; score: number }[] = [];

    projects.forEach((project) => {
      totalStars += project.star_count;

      // Simple scoring for GitLab projects
      let score = 0;
      score += Math.min(Math.log10(project.star_count + 1) * 15, 30);
      score += Math.min(Math.log10(project.forks_count + 1) * 10, 20);

      // Recency bonus
      const lastActivity = new Date(project.last_activity_at);
      const year2025Start = new Date("2025-01-01");
      if (lastActivity >= year2025Start) {
        score += 15;
      }

      projectScores.push({ project, score });
    });

    // Sort by score and get top 5
    projectScores.sort((a, b) => b.score - a.score);
    const topCandidates = projectScores.slice(0, 5);
    const bestProject = topCandidates[0]?.project || null;

    // Get languages from top projects (GitLab requires separate API call per project)
    // For simplicity, we'll use topics as proxy or just show "Various"
    const langScoreMap = new Map<
      string,
      { name: string; weight: number; repoCount: number; recentCount: number }
    >();

    // Use topics as categories since language detection requires extra API calls
    projects.forEach((project) => {
      if (project.topics && project.topics.length > 0) {
        // Use first topic as "language" proxy
        const topic = project.topics[0];
        const existing = langScoreMap.get(topic) || {
          name: topic,
          weight: 0,
          repoCount: 0,
          recentCount: 0,
        };
        existing.weight += 1;
        existing.repoCount += 1;
        langScoreMap.set(topic, existing);
      }
    });

    // If we have topics as languages, calculate percentages
    let topLanguages: Language[];
    if (langScoreMap.size > 0) {
      const sorted = Array.from(langScoreMap.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);
      const totalWeight = sorted.reduce((sum, l) => sum + l.weight, 0);
      topLanguages = sorted.map((lang) => ({
        name: lang.name,
        count: lang.repoCount,
        percentage: Math.round((lang.weight / totalWeight) * 100),
        color: langColors[lang.name] || "#A3A3A3",
      }));

      // Fix rounding
      const sum = topLanguages.reduce((s, l) => s + l.percentage, 0);
      if (sum !== 100 && topLanguages.length > 0) {
        topLanguages[0].percentage += 100 - sum;
      }
    } else {
      topLanguages = [
        { name: "Polyglot", count: 1, percentage: 100, color: "#FFFFFF" },
      ];
    }

    // Build top repo
    const topRepo: Repository = bestProject
      ? {
          name: bestProject.name,
          description:
            bestProject.description ||
            "A project that speaks through its code.",
          stars: bestProject.star_count,
          language: bestProject.topics?.[0] || "Unknown",
          topics: bestProject.topics || [],
          url: bestProject.web_url,
        }
      : {
          name: "No Public Repos",
          description: "Start coding to write history.",
          stars: 0,
          language: "N/A",
          topics: [],
          url: "",
        };

    // Build top 5 repos
    const topRepos: Repository[] = topCandidates.map((c) => ({
      name: c.project.name,
      description:
        c.project.description || "A project that speaks through its code.",
      stars: c.project.star_count,
      language: c.project.topics?.[0] || "Unknown",
      topics: c.project.topics || [],
      url: c.project.web_url,
    }));

    // 6. Calculate productivity from events
    const hourCounts: Record<number, number> = {};
    events.forEach((event) => {
      const hour = new Date(event.created_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const productivity = calculateProductivity(hourCounts);

    // 7. Community stats
    const communityStats: CommunityStats = {
      followers: user.followers || 0,
      following: user.following || 0,
      publicRepos: projects.length,
      totalStars: totalStars,
    };

    // 8. Calculate archetype
    const archetype = calculateArchetype(
      contributionBreakdown,
      communityStats,
      totalCommits,
      productivity,
      weekdayStats
    );

    return {
      username: user.username,
      avatarUrl: user.avatar_url,
      year: 2025,
      totalCommits,
      longestStreak: maxStreak,
      busiestDay,
      topLanguages,
      topRepo,
      topRepos,
      velocityData,
      weekdayStats,
      productivity,
      archetype,
      contributionBreakdown,
      community: communityStats,
      contributions,
      joinedAt: user.created_at,
      platform: "gitlab",
    };
  } catch (error) {
    console.error("Error generating GitLab story:", error);
    throw error;
  }
};
