export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'meta' | 'deepseek';

export type RunStatus =
  | 'queued'
  | 'generating'
  | 'installing'
  | 'building'
  | 'starting'
  | 'healthy'
  | 'ready'
  | 'failed'
  | 'terminated';

export interface Run {
  id: string;
  sessionId: string;
  provider: ModelProvider;
  model: string;
  status: RunStatus;
  port?: number;
  containerId?: string;
  internalUrl?: string;
  error?: string;
  logsInstall?: string;
  logsBuild?: string;
  logsError?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Session {
  id: string;
  prompt: string;
  runs: Run[];
  createdAt: Date;
}

export interface GeneratedCode {
  files: Record<string, string>;
}

export interface LLMResponse {
  code: GeneratedCode;
  model: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface DockerContainer {
  id: string;
  runId: string;
  port: number;
  internalUrl?: string;
  status: 'building' | 'running' | 'stopped' | 'failed';
}
