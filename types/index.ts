export type RunStatus =
  | 'queued'
  | 'installing'
  | 'building'
  | 'starting'
  | 'healthy'
  | 'capturing'
  | 'ready'
  | 'failed'
  | 'terminated';

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'meta' | 'deepseek';

export interface Session {
  id: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
  runs: Run[];
}

export interface Run {
  id: string;
  sessionId: string;
  model: string;
  provider: ModelProvider;
  status: RunStatus;
  port?: number;
  containerId?: string;
  internalUrl?: string;
  publicUrl?: string;
  error?: string;
  // Log strings
  logsNpmCi?: string;
  logsNpmBuild?: string;
  logsNpmStart?: string;
  logsError?: string;
  // Screenshot URLs
  screenshotDesktop?: string;
  screenshotMobile?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface GeneratedCode {
  files: Record<string, string>; // filepath -> content
}

export interface CreateSessionRequest {
  prompt: string;
  models: Array<{
    provider: ModelProvider;
    model: string;
  }>;
}

export interface CreateSessionResponse {
  sessionId: string;
  runIds: string[];
}

export interface GetSessionResponse extends Session {}

export interface RunEvent {
  runId: string;
  type: 'status' | 'log' | 'screenshot';
  data: any;
  timestamp: Date;
}
