import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITLAB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitLab OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate a random state for CSRF protection
  // Prefix with 'gitlab_' to identify the provider in callback
  const state = `gitlab_${crypto.randomUUID()}`;

  // GitLab OAuth scopes needed for GitStory
  const scopes = ["read_user", "read_api", "read_repository"].join(" ");

  // Build the GitLab authorization URL
  const authUrl = new URL("https://gitlab.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "redirect_uri",
    `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/api/auth/callback`
  );

  // Create response with redirect
  const response = NextResponse.redirect(authUrl.toString());

  // Store state in HTTP-only cookie for verification
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return response;
}
