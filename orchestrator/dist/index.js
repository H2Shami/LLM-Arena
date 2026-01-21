import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { LLMClient } from './llm-client.js';
import { DockerRuntime } from './docker-runtime.js';
import { RunManager } from './run-manager.js';
import { GatewayRegistry } from './gateway-registry.js';
// Load environment variables from parent directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });
const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 8080;
// Middleware
app.use(cors());
app.use(express.json());
// Initialize components
const llmClient = new LLMClient();
const dockerRuntime = new DockerRuntime();
const gatewayRegistry = new GatewayRegistry();
const runManager = new RunManager(llmClient, dockerRuntime, gatewayRegistry);
// ===== API Routes =====
/**
 * Start all runs in a session
 */
app.post('/api/sessions/:sessionId/start', async (req, res) => {
    const { sessionId } = req.params;
    const { prompt, runs } = req.body;
    console.log(`[Orchestrator] Starting session ${sessionId} with ${runs.length} runs`);
    // Start all runs in parallel
    for (const run of runs) {
        // Process in background, don't await
        runManager.processRun(run, prompt).catch(err => {
            console.error(`[Orchestrator] Run ${run.id} failed:`, err);
        });
    }
    res.json({ success: true, message: `Started ${runs.length} runs` });
});
/**
 * Start a specific run
 */
app.post('/api/runs/:runId/start', async (req, res) => {
    const { runId } = req.params;
    const { prompt, run } = req.body;
    console.log(`[Orchestrator] Starting run ${runId}`);
    // Process in background
    runManager.processRun(run, prompt).catch(err => {
        console.error(`[Orchestrator] Run ${runId} failed:`, err);
    });
    res.json({ success: true, message: `Started run ${runId}` });
});
/**
 * Kill a run
 */
app.delete('/api/runs/:runId', async (req, res) => {
    const { runId } = req.params;
    try {
        await runManager.killRun(runId);
        gatewayRegistry.unregister(runId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get logs for a run
 */
app.get('/api/runs/:runId/logs', async (req, res) => {
    const { runId } = req.params;
    try {
        const logs = await runManager.getLogs(runId);
        res.json({ logs });
    }
    catch (error) {
        res.status(404).json({ error: error.message });
    }
});
/**
 * Resolve run ID to internal URL (for Caddy reverse proxy)
 */
app.get('/gateway/resolve/:runId', (req, res) => {
    const { runId } = req.params;
    const url = gatewayRegistry.resolve(runId);
    if (url) {
        res.json({ url });
    }
    else {
        res.status(404).json({ error: 'Run not found' });
    }
});
/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});
/**
 * Stats endpoint
 */
app.get('/stats', (req, res) => {
    res.json({
        activeContainers: dockerRuntime.getActiveContainers().length,
        registeredRuns: gatewayRegistry.size(),
    });
});
// ===== Server Startup =====
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         LLM Vibe Coding Arena - Orchestrator                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

  Status: Running
  Port: ${PORT}

  Endpoints:
  - POST   /api/sessions/:id/start     Start all runs in session
  - POST   /api/runs/:id/start         Start a specific run
  - DELETE /api/runs/:id                Kill a run
  - GET    /api/runs/:id/logs           Get run logs
  - GET    /gateway/resolve/:runId      Resolve run to URL (Caddy)
  - GET    /health                      Health check
  - GET    /stats                       Stats

  Using Docker network: llm-arena-network
  Previews accessible via: *.preview.localhost (with Caddy)

  Ready to orchestrate! 🚀
`);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Orchestrator] SIGTERM received, shutting down gracefully');
    const containers = dockerRuntime.getActiveContainers();
    console.log(`[Orchestrator] Killing ${containers.length} active containers...`);
    for (const runId of containers) {
        try {
            await runManager.killRun(runId);
        }
        catch (e) {
            console.error(`[Orchestrator] Failed to kill ${runId}`);
        }
    }
    process.exit(0);
});
