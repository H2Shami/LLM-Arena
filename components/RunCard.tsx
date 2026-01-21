"use client";

import { useState } from "react";
import { Run } from "@/types";
import { PreviewFrame } from "./PreviewFrame";
import { StatusBadge } from "./StatusBadge";
import { formatDuration } from "@/lib/utils";
import { ChevronDown, ChevronUp, Terminal, ExternalLink } from "lucide-react";

interface RunCardProps {
  run: Run;
}

export function RunCard({ run }: RunCardProps) {
  const [showLogs, setShowLogs] = useState(false);

  const duration = run.startedAt && run.completedAt
    ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
    : run.startedAt
    ? Date.now() - new Date(run.startedAt).getTime()
    : null;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{run.model}</h3>
            <p className="text-sm text-gray-500 capitalize">{run.provider}</p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
          {duration && (
            <span className="flex items-center gap-1">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatDuration(duration)}
            </span>
          )}
          {run.publicUrl && run.status === "ready" && (
            <a
              href={run.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="w-3 h-3" />
              Open in New Tab
            </a>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-[400px] p-4">
        <PreviewFrame run={run} />
      </div>

      {/* Logs Section */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Build Logs
          </span>
          {showLogs ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showLogs && (
          <div className="px-4 pb-4 space-y-3">
            {run.logsNpmCi && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900 mb-1">
                  npm ci
                </summary>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
                  {run.logsNpmCi}
                </pre>
              </details>
            )}

            {run.logsNpmBuild && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900 mb-1">
                  npm run build
                </summary>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
                  {run.logsNpmBuild}
                </pre>
              </details>
            )}

            {run.logsNpmStart && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900 mb-1">
                  npm run start
                </summary>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-48">
                  {run.logsNpmStart}
                </pre>
              </details>
            )}

            {run.logsError && (
              <details open className="group">
                <summary className="cursor-pointer text-xs font-medium text-red-700 hover:text-red-900 mb-1">
                  Error Logs
                </summary>
                <pre className="text-xs bg-red-900 text-red-100 p-3 rounded overflow-auto max-h-48">
                  {run.logsError}
                </pre>
              </details>
            )}

            {!run.logsNpmCi && !run.logsNpmBuild && !run.logsNpmStart && (
              <p className="text-xs text-gray-500 italic">No logs available yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
