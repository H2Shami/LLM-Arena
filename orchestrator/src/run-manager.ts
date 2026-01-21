import { Run, RunStatus } from './types.js';
import { LLMClient } from './llm-client.js';
import { DockerRuntime } from './docker-runtime.js';
import { GatewayRegistry } from './gateway-registry.js';
import axios from 'axios';

/**
 * Run Lifecycle Manager
 *
 * Orchestrates the complete lifecycle of a run:
 * 1. Call LLM to generate page.tsx code
 * 2. Build in Docker with template (npm install, npm run build)
 * 3. Start container (npm run start)
 * 4. Health check
 * 5. Register with GatewayRegistry for Caddy routing
 * 6. Mark as ready
 */
export class RunManager {
  private llmClient: LLMClient;
  private dockerRuntime: DockerRuntime;
  private gatewayRegistry: GatewayRegistry;
  private mainAppUrl: string;

  constructor(llmClient: LLMClient, dockerRuntime: DockerRuntime, gatewayRegistry: GatewayRegistry) {
    this.llmClient = llmClient;
    this.dockerRuntime = dockerRuntime;
    this.gatewayRegistry = gatewayRegistry;
    this.mainAppUrl = process.env.MAIN_APP_URL || 'http://localhost:3000';
  }

  /**
   * Process a run through its complete lifecycle
   */
  async processRun(run: Run, prompt: string): Promise<void> {
    console.log(`[RunManager] Processing run ${run.id} (${run.provider}/${run.model})`);

    try {
      await this.updateRunStatus(run.id, 'generating', { startedAt: new Date() });

      // Step 1: Call LLM to generate code
      console.log(`[RunManager] Calling LLM for ${run.id}`);
      const llmResponse = await this.llmClient.generateCode(
        prompt,
        run.provider,
        run.model
      );

      // Validate generated code
      this.llmClient.validateCode(llmResponse.code);

      await this.updateRunStatus(run.id, 'installing');

      // Step 2: Create Docker container and build
      console.log(`[RunManager] Building in Docker for ${run.id}`);
      const container = await this.dockerRuntime.createRun(run.id, llmResponse.code);

      await this.updateRun(run.id, {
        status: 'starting',
        containerId: container.id,
        internalUrl: container.internalUrl,
      });

      // Step 3: Wait for health check using internal URL
      console.log(`[RunManager] Waiting for health check for ${run.id} at ${container.internalUrl}`);
      const healthy = await this.waitForHealthyUrl(container.internalUrl!, 30);

      if (!healthy) {
        throw new Error('Server failed health check after 30 attempts');
      }

      await this.updateRunStatus(run.id, 'healthy');

      // Step 4: Register with gateway for Caddy routing
      this.gatewayRegistry.registerUrl(run.id, container.internalUrl!);

      // Step 5: Mark as ready
      await this.updateRun(run.id, {
        status: 'ready',
        completedAt: new Date(),
      });

      console.log(`[RunManager] Run ${run.id} is ready at ${container.internalUrl}!`);

    } catch (error: any) {
      console.error(`[RunManager] Run ${run.id} failed:`, error.message);

      await this.updateRun(run.id, {
        status: 'failed',
        error: error.message,
        logsError: error.stack,
        completedAt: new Date(),
      });

      try {
        await this.dockerRuntime.killRun(run.id);
      } catch (cleanupError) {
        console.error(`[RunManager] Cleanup failed for ${run.id}:`, cleanupError);
      }
    }
  }

  /**
   * Wait for container to be healthy using internal URL
   */
  private async waitForHealthyUrl(url: string, maxAttempts: number = 30): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Container not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false;
  }

  /**
   * Update run status in main app
   */
  private async updateRunStatus(runId: string, status: RunStatus, extra: Partial<Run> = {}): Promise<void> {
    await this.updateRun(runId, { status, ...extra });
  }

  /**
   * Update run data in main app's store
   */
  private async updateRun(runId: string, updates: Partial<Run>): Promise<void> {
    try {
      await axios.patch(`${this.mainAppUrl}/api/runs/${runId}`, updates);
    } catch (error: any) {
      console.error(`[RunManager] Failed to update run ${runId}:`, error.message);
    }
  }

  /**
   * Kill a run and cleanup resources
   */
  async killRun(runId: string): Promise<void> {
    console.log(`[RunManager] Killing run ${runId}`);

    try {
      await this.dockerRuntime.killRun(runId);
      await this.updateRunStatus(runId, 'terminated');
    } catch (error: any) {
      console.error(`[RunManager] Error killing run ${runId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get logs for a run
   */
  async getLogs(runId: string): Promise<string> {
    return await this.dockerRuntime.getLogs(runId);
  }
}
