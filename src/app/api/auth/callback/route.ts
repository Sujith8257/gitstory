import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial or error
  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=missing_params", request.url)
    );
  }

  // Verify state matches (CSRF protection)
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  // Detect provider from state prefix
  const isGitLab = state.startsWith("gitlab_");
  const isGitHub = state.startsWith("github_");

  if (!isGitLab && !isGitHub) {
    return NextResponse.redirect(
      new URL("/?error=unknown_provider", request.url)
    );
  }

  try {
    let accessToken: string;
    let provider: "github" | "gitlab";

    if (isGitHub) {
      // GitHub OAuth
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL("/?error=github_oauth_not_configured", request.url)
        );
      }

      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("GitHub OAuth token error:", tokenData);
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(tokenData.error)}`, request.url)
        );
      }

      accessToken = tokenData.access_token;
      provider = "github";
    } else {
      // GitLab OAuth
      const clientId = process.env.GITLAB_CLIENT_ID;
      const clientSecret = process.env.GITLAB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.redirect(
          new URL("/?error=gitlab_oauth_not_configured", request.url)
        );
      }

      const tokenResponse = await fetch("https://gitlab.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${
            process.env.NEXTAUTH_URL || request.nextUrl.origin
          }/api/auth/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error("GitLab OAuth token error:", tokenData);
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(tokenData.error)}`, request.url)
        );
      }

      accessToken = tokenData.access_token;
      provider = "gitlab";
    }

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/?error=no_access_token", request.url)
      );
    }

    // Create redirect response to home page
    const response = NextResponse.redirect(new URL("/", request.url));

    // Clear the oauth_state cookie
    response.cookies.delete("oauth_state");

    // Store the access token in a secure HTTP-only cookie
    response.cookies.set("gitstory_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Store the provider in a separate cookie
    response.cookies.set("gitstory_provider", provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
