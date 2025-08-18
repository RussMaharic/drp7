import { NextResponse } from "next/server";
import { clearTokens } from "../shopify/route";
import { TokenManager } from "@/lib/token-manager";

export async function POST() {
  try {
    // Clear from Supabase
    await TokenManager.clearAllTokens();
    
    // Clear from in-memory (fallback)
    clearTokens();
    
    return NextResponse.json({ success: true, message: "Tokens cleared successfully from both Supabase and memory" });
  } catch (error) {
    console.error("Error clearing tokens:", error);
    return NextResponse.json({ error: "Failed to clear tokens" }, { status: 500 });
  }
} 