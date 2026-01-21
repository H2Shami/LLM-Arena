import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getPreviewUrl } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = store.getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Format the response
    const formattedSession = {
      ...session,
      runs: session.runs.map((run) => ({
        ...run,
        // Use direct port URL if available, otherwise use subdomain pattern
        publicUrl: run.status === "ready"
          ? (run.port ? `http://localhost:${run.port}` : getPreviewUrl(run.id))
          : null,
      })),
    };

    return NextResponse.json(formattedSession);
  } catch (error: any) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
