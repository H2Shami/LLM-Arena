import { Session, Run, RunStatus, ModelProvider } from "@/types";
import { nanoid } from "nanoid";

/**
 * In-memory store for sessions and runs.
 *
 * This is simpler than a database for our use case since:
 * - Sessions are ephemeral (containers die after 30min)
 * - No need to persist historical data
 * - Faster than DB queries
 * - One less dependency to manage
 */

class Store {
  private sessions: Map<string, Session> = new Map();
  private runs: Map<string, Run> = new Map();

  // Session methods
  createSession(prompt: string, models: Array<{ provider: ModelProvider; model: string }>): Session {
    const sessionId = nanoid();
    const now = new Date();

    const runs: Run[] = models.map((modelConfig) => {
      const runId = nanoid();
      const run: Run = {
        id: runId,
        sessionId,
        model: modelConfig.model,
        provider: modelConfig.provider,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      };
      this.runs.set(runId, run);
      return run;
    });

    const session: Session = {
      id: sessionId,
      prompt,
      runs,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Return session with latest run data
    return {
      ...session,
      runs: session.runs.map((run) => this.runs.get(run.id)!),
    };
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map((session) => ({
      ...session,
      runs: session.runs.map((run) => this.runs.get(run.id)!),
    }));
  }

  // Run methods
  getRun(runId: string): Run | undefined {
    return this.runs.get(runId);
  }

  updateRun(runId: string, updates: Partial<Run>): Run | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;

    const updatedRun: Run = {
      ...run,
      ...updates,
      updatedAt: new Date(),
    };

    this.runs.set(runId, updatedRun);

    // Update session's updatedAt timestamp
    const session = this.sessions.get(run.sessionId);
    if (session) {
      session.updatedAt = new Date();
    }

    return updatedRun;
  }

  getRunsBySession(sessionId: string): Run[] {
    return Array.from(this.runs.values()).filter(
      (run) => run.sessionId === sessionId
    );
  }

  getRunsByStatus(status: RunStatus): Run[] {
    return Array.from(this.runs.values()).filter((run) => run.status === status);
  }

  // Cleanup methods (for idle timeout)
  deleteRun(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    this.runs.delete(runId);

    // Update session
    const session = this.sessions.get(run.sessionId);
    if (session) {
      session.runs = session.runs.filter((r) => r.id !== runId);
      if (session.runs.length === 0) {
        // All runs deleted, delete session too
        this.sessions.delete(run.sessionId);
      }
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Delete all runs
    session.runs.forEach((run) => {
      this.runs.delete(run.id);
    });

    // Delete session
    this.sessions.delete(sessionId);
  }

  // Stats
  getStats() {
    return {
      totalSessions: this.sessions.size,
      totalRuns: this.runs.size,
      runsByStatus: {
        queued: this.getRunsByStatus("queued").length,
        installing: this.getRunsByStatus("installing").length,
        building: this.getRunsByStatus("building").length,
        starting: this.getRunsByStatus("starting").length,
        healthy: this.getRunsByStatus("healthy").length,
        capturing: this.getRunsByStatus("capturing").length,
        ready: this.getRunsByStatus("ready").length,
        failed: this.getRunsByStatus("failed").length,
        terminated: this.getRunsByStatus("terminated").length,
      },
    };
  }

  // Clear everything (useful for testing)
  clear(): void {
    this.sessions.clear();
    this.runs.clear();
  }
}

// Singleton instance
export const store = new Store();
