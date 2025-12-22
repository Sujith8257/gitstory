import { fetchUserStory } from "@/services/githubService";
import { fetchGitLabUserStory } from "@/services/gitlabService";
import StoryView from "@/components/StoryView";
import { GitStoryData } from "@/types";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { siteConfig } from "@/lib/config";
import { cookies } from "next/headers";

interface PageProps {
  params: Promise<{ githubId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { githubId } = await params;

  // Try to fetch basic user data for metadata
  // We use a lightweight approach here to avoid double-fetching
  let title = `@${githubId}'s Story`;
  let description = `Discover @${githubId}'s coding journey - commits, streaks, languages, and more. Every commit tells a story.`;

  const baseUrl = siteConfig.url;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | GitStory`,
      description,
      url: `${baseUrl}/${githubId}`,
      siteName: "GitStory",
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: `${title} | GitStory`,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/${githubId}`,
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const { githubId } = await params;

  // Read OAuth token and provider from HTTP-only cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("gitstory_token")?.value;
  const provider = cookieStore.get("gitstory_provider")?.value as
    | "github"
    | "gitlab"
    | undefined;

  // Fetch data on the server side using the appropriate service
  let storyData: GitStoryData | null = null;
  let error = null;

  try {
    // Use GitLab service if provider is gitlab, otherwise default to GitHub
    if (provider === "gitlab") {
      storyData = await fetchGitLabUserStory(githubId, token);
    } else {
      storyData = await fetchUserStory(githubId, token);
    }
  } catch (e) {
    console.error("Failed to fetch story data", e);
    error = e instanceof Error ? e.message : "Failed to load story";
  }

  if (!storyData && !error) {
    notFound();
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 text-center bg-black">
        <h1 className="text-2xl font-bold text-red-500 mb-4">
          Story couldn&apos;t be written
        </h1>
        <p className="text-neutral-400 mb-8 max-w-md">{error}</p>
        <a
          href="/"
          className="px-6 py-3 bg-white text-black font-medium rounded-full hover:opacity-90 transition-opacity"
        >
          Try Another Story
        </a>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden">
      <StoryView data={storyData!} />
    </main>
  );
}
