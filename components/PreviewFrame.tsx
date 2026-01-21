"use client";

import { useState } from "react";
import { Play, XCircle, Loader2 } from "lucide-react";
import { Run } from "@/types";
import { getPreviewUrl } from "@/lib/utils";

interface PreviewFrameProps {
  run: Run;
}

export function PreviewFrame({ run }: PreviewFrameProps) {
  const [showLive, setShowLive] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Failed state
  if (run.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 p-6 rounded-lg">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Build Failed</h3>
        <p className="text-sm text-red-700 text-center mb-4">
          {run.error || "This model's generated code failed to build or start."}
        </p>
        {run.logsNpmBuild && (
          <details className="w-full max-w-2xl">
            <summary className="cursor-pointer text-sm font-medium text-red-800 hover:text-red-900">
              View Build Logs
            </summary>
            <pre className="mt-2 p-4 bg-red-100 rounded text-xs overflow-auto max-h-64 text-left">
              {run.logsNpmBuild}
            </pre>
          </details>
        )}
      </div>
    );
  }

  // Not ready yet - show screenshot if available
  if (run.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-blue-50 p-6 rounded-lg">
        <Loader2 className="w-16 h-16 text-blue-500 mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Building...</h3>
        <p className="text-sm text-blue-700 text-center">
          {run.status === "installing" && "Installing npm packages..."}
          {run.status === "building" && "Running next build..."}
          {run.status === "starting" && "Starting production server..."}
          {run.status === "capturing" && "Capturing screenshots..."}
          {run.status === "queued" && "Waiting in queue..."}
        </p>
      </div>
    );
  }

  // Use direct port URL if available
  const previewUrl = run.port ? `http://localhost:${run.port}` : getPreviewUrl(run.id);

  // Ready - show screenshot with "View Live" button, or iframe
  if (!showLive && run.screenshotDesktop) {
    return (
      <div className="relative h-full bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={run.screenshotDesktop}
          alt="Preview screenshot"
          className="w-full h-full object-cover object-top"
        />
        <button
          onClick={() => setShowLive(true)}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 hover:bg-black/70 transition group"
        >
          <Play className="w-16 h-16 text-white mb-2 group-hover:scale-110 transition" />
          <span className="text-white font-semibold text-lg">View Live Preview</span>
        </button>
      </div>
    );
  }

  // Live iframe
  return (
    <div className="relative h-full bg-white rounded-lg overflow-hidden">
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      )}
      <iframe
        src={previewUrl}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        referrerPolicy="no-referrer"
        loading="lazy"
        title={`Preview for ${run.model}`}
        className="w-full h-full border-0"
        onLoad={() => setIframeLoaded(true)}
      />
    </div>
  );
}
