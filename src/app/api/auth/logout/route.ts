import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear both token and provider cookies
  response.cookies.delete("gitstory_token");
  response.cookies.delete("gitstory_provider");

  return response;
}
