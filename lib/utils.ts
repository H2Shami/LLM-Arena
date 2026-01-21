import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'text-green-600 bg-green-50';
    case 'failed':
      return 'text-red-600 bg-red-50';
    case 'queued':
    case 'installing':
    case 'building':
    case 'starting':
    case 'capturing':
      return 'text-blue-600 bg-blue-50';
    case 'terminated':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getPreviewUrl(runId: string): string {
  const domain = process.env.NEXT_PUBLIC_PREVIEW_DOMAIN || 'preview.localhost:3000';
  const protocol = domain.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${runId}.${domain}`;
}
