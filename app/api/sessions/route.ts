import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { z } from "zod";

const createSessionSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  models: z
    .array(
      z.object({
        provider: z.enum(["openai", "anthropic", "google", "xai", "meta", "deepseek"]),
        model: z.string(),
      })
    )
    .min(1, "At least one model is required")
    .max(6, "Maximum 6 models allowed"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = createSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { prompt, models } = validation.data;

    // Create session with runs
    const session = store.createSession(prompt, models);

    // Trigger orchestrator to start building runs
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8080';

    try {
      await fetch(`${orchestratorUrl}/api/sessions/${session.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: session.prompt,
          runs: session.runs,
        }),
      });
      console.log(`Triggered orchestrator for session ${session.id}`);
    } catch (error: any) {
      console.error('Failed to trigger orchestrator:', error.message);
      // Don't fail the request - orchestrator might not be running yet
    }

    return NextResponse.json({
      sessionId: session.id,
      runIds: session.runs.map((run) => run.id),
    });
  } catch (error: any) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
