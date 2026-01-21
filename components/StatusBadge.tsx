import { getStatusColor } from "@/lib/utils";
import { RunStatus } from "@/types";

interface StatusBadgeProps {
  status: RunStatus;
}

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  installing: "Installing Dependencies",
  building: "Building",
  starting: "Starting Server",
  healthy: "Health Check",
  capturing: "Capturing Screenshot",
  ready: "Ready",
  failed: "Failed",
  terminated: "Terminated",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
        status
      )}`}
    >
      {status === "queued" ||
      status === "installing" ||
      status === "building" ||
      status === "starting" ||
      status === "capturing" ? (
        <span className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
          {STATUS_LABELS[status]}
        </span>
      ) : (
        STATUS_LABELS[status]
      )}
    </span>
  );
}
