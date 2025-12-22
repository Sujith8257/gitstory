import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gitstory_token")?.value;
  const provider = request.cookies.get("gitstory_provider")?.value as
    | "github"
    | "gitlab"
    | undefined;

  if (!token || !provider) {
    return NextResponse.json({
      user: null,
      authenticated: false,
      provider: null,
    });
  }

  try {
    let user;

    if (provider === "github") {
      // Fetch user info from GitHub
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        return NextResponse.json({
          user: null,
          authenticated: false,
          provider: null,
        });
      }

      const data = await response.json();
      user = {
        login: data.login,
        avatar_url: data.avatar_url,
        name: data.name,
        id: data.id,
      };
    } else if (provider === "gitlab") {
      // Fetch user info from GitLab
      const response = await fetch("https://gitlab.com/api/v4/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({
          user: null,
          authenticated: false,
          provider: null,
        });
      }

      const data = await response.json();
      user = {
        login: data.username,
        avatar_url: data.avatar_url,
        name: data.name,
        id: data.id,
      };
    } else {
      return NextResponse.json({
        user: null,
        authenticated: false,
        provider: null,
      });
    }

    return NextResponse.json({
      user,
      authenticated: true,
      provider,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({
      user: null,
      authenticated: false,
      provider: null,
    });
  }
}
