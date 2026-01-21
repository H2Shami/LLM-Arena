"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Session } from "@/types";
import { RunCard } from "@/components/RunCard";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function ArenaPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Session not found");
        }
        throw new Error("Failed to fetch session");
      }
      const data = await response.json();
      setSession(data);
      setError(null);

      // Stop auto-refresh if all runs are completed
      const allCompleted = data.runs.every(
        (run: any) =>
          run.status === "ready" ||
          run.status === "failed" ||
          run.status === "terminated"
      );
      if (allCompleted) {
        setAutoRefresh(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchSession();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading arena...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const completedRuns = session.runs.filter(
    (run) => run.status === "ready" || run.status === "failed"
  ).length;
  const totalRuns = session.runs.length;
  const allCompleted = completedRuns === totalRuns;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/"
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">
                  Arena: {completedRuns} / {totalRuns} Complete
                </h1>
                {!allCompleted && (
                  <RefreshCw
                    className={`w-5 h-5 text-gray-400 ${
                      autoRefresh ? "animate-spin" : ""
                    }`}
                  />
                )}
              </div>
              <p className="text-gray-600 line-clamp-2">{session.prompt}</p>
            </div>
            <button
              onClick={() => {
                setAutoRefresh(!autoRefresh);
                if (!autoRefresh) fetchSession();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                autoRefresh
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of run cards */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {session.runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>

        {allCompleted && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 text-green-700 rounded-lg border border-green-200">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              All models have finished!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
