import { signOut } from "@/auth";

// Used when a session is no longer valid (user deactivated, agency suspended).
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
