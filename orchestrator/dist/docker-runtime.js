import Docker from 'dockerode';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NETWORK_NAME = 'llm-arena-network';
/**
 * Docker Runtime Manager
 *
 * Handles the two-phase execution model:
 * Phase 1: Build with network (npm ci, npm run build)
 * Phase 2: Run on internal network (npm run start)
 *
 * Containers are accessed via their internal IP on the Docker network,
 * avoiding host port conflicts.
 */
export class DockerRuntime {
    docker;
    containers;
    workspaceBase;
    constructor() {
        const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
        this.docker = new Docker({ socketPath });
        this.containers = new Map();
        this.workspaceBase = process.env.WORKSPACE_BASE || '/tmp/llm-arena-workspaces';
        this.initialize();
    }
    async initialize() {
        await this.verifyDockerConnection();
        await this.ensureNetwork();
    }
    async verifyDockerConnection() {
        try {
            await this.docker.ping();
            console.log('[Docker] Connected successfully');
        }
        catch (error) {
            console.error('[Docker] Failed to connect to Docker daemon');
            console.error('[Docker] Make sure Docker Desktop is running');
            console.error('[Docker] Error:', error.message);
        }
    }
    /**
     * Ensure the Docker network exists
     */
    async ensureNetwork() {
        try {
            const networks = await this.docker.listNetworks({
                filters: { name: [NETWORK_NAME] }
            });
            if (networks.length === 0) {
                await this.docker.createNetwork({
                    Name: NETWORK_NAME,
                    Driver: 'bridge',
                });
                console.log(`[Docker] Created network: ${NETWORK_NAME}`);
            }
            else {
                console.log(`[Docker] Network exists: ${NETWORK_NAME}`);
            }
        }
        catch (error) {
            console.error('[Docker] Failed to create network:', error.message);
        }
    }
    /**
     * Create and run a Next.js app in Docker (two-phase execution)
     */
    async createRun(runId, code) {
        const workspaceDir = `${this.workspaceBase}/${runId}`;
        try {
            console.log(`[Docker] Starting run ${runId}`);
            // Prepare workspace
            await this.prepareWorkspace(workspaceDir, code);
            // Phase 1: Build with network
            await this.buildPhase(runId, workspaceDir);
            // Phase 2: Run on internal network with random host port
            const { container, ip, hostPort } = await this.runPhase(runId, workspaceDir);
            this.containers.set(runId, { container, ip, hostPort });
            console.log(`[Docker] Container ${runId} accessible at localhost:${hostPort}`);
            return {
                id: container.id,
                runId,
                port: hostPort, // Random host port assigned by Docker
                internalUrl: `http://localhost:${hostPort}`,
                status: 'running',
            };
        }
        catch (error) {
            await this.cleanupWorkspace(workspaceDir);
            throw error;
        }
    }
    /**
     * Prepare workspace by copying template and writing generated files
     */
    async prepareWorkspace(dir, code) {
        console.log(`[Docker] Preparing workspace: ${dir}`);
        // Get template directory (relative to this file's location)
        const templateDir = path.resolve(__dirname, '..', 'template');
        // Create workspace and copy template
        await execAsync(`mkdir -p "${dir}"`);
        await execAsync(`cp -r "${templateDir}/"* "${dir}/"`);
        console.log(`[Docker] Copied template from ${templateDir}`);
        // Overlay generated files (typically just app/page.tsx)
        for (const [filePath, content] of Object.entries(code.files)) {
            const fullPath = path.join(dir, filePath);
            const fileDir = path.dirname(fullPath);
            await execAsync(`mkdir -p "${fileDir}"`);
            await fs.writeFile(fullPath, content, 'utf-8');
        }
        console.log(`[Docker] Wrote ${Object.keys(code.files).length} generated files`);
    }
    /**
     * Phase 1: Build with network access
     */
    async buildPhase(runId, workspaceDir) {
        console.log(`[Docker] Phase 1: Building ${runId}`);
        const buildContainer = await this.docker.createContainer({
            name: `build-${runId}`,
            Image: 'node:20-alpine',
            WorkingDir: '/workspace',
            Cmd: ['/bin/sh', '-c', 'npm install --legacy-peer-deps && NODE_ENV=production npm run build'],
            HostConfig: {
                Memory: 4 * 1024 * 1024 * 1024,
                NanoCpus: 2 * 1e9,
                NetworkMode: 'bridge',
                Binds: [`${workspaceDir}:/workspace:rw`],
                AutoRemove: false,
            },
            Env: [
                'NEXT_TELEMETRY_DISABLED=1',
                'NPM_CONFIG_UPDATE_NOTIFIER=false',
            ],
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
        });
        await buildContainer.start();
        const logStream = await buildContainer.logs({
            follow: true,
            stdout: true,
            stderr: true,
        });
        let logs = '';
        logStream.on('data', (chunk) => {
            logs += chunk.toString();
        });
        const result = await buildContainer.wait();
        await buildContainer.remove();
        if (result.StatusCode !== 0) {
            throw new Error(`Build failed with exit code ${result.StatusCode}:\n${logs}`);
        }
        console.log(`[Docker] Build completed for ${runId}`);
    }
    /**
     * Phase 2: Run on internal Docker network with random host port
     *
     * Uses Docker network for container-to-container communication,
     * but also exposes a random host port for health checks (Docker Desktop for Mac
     * can't reach container IPs directly from the host).
     */
    async runPhase(runId, workspaceDir) {
        console.log(`[Docker] Phase 2: Running ${runId} on network ${NETWORK_NAME}`);
        const runContainer = await this.docker.createContainer({
            name: `run-${runId}`,
            Image: 'node:20-alpine',
            WorkingDir: '/workspace',
            Cmd: ['npm', 'run', 'start'],
            Env: [
                'PORT=3000',
                'HOSTNAME=0.0.0.0',
                'NODE_ENV=production',
                'NEXT_TELEMETRY_DISABLED=1',
            ],
            ExposedPorts: {
                '3000/tcp': {},
            },
            HostConfig: {
                Memory: 2 * 1024 * 1024 * 1024,
                NanoCpus: 1 * 1e9,
                NetworkMode: NETWORK_NAME,
                // Let Docker assign a random available port
                PortBindings: {
                    '3000/tcp': [{ HostPort: '' }], // Empty string = random port
                },
                Binds: [`${workspaceDir}:/workspace:ro`],
                SecurityOpt: ['no-new-privileges:true'],
                CapDrop: ['ALL'],
                PidsLimit: 512,
                AutoRemove: false,
            },
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
        });
        await runContainer.start();
        // Get the container's info
        const inspect = await runContainer.inspect();
        const ip = inspect.NetworkSettings.Networks[NETWORK_NAME]?.IPAddress || '';
        const portBinding = inspect.NetworkSettings.Ports['3000/tcp'];
        const hostPort = portBinding && portBinding[0] ? parseInt(portBinding[0].HostPort) : 0;
        if (!hostPort) {
            throw new Error(`Failed to get host port for container ${runId}`);
        }
        console.log(`[Docker] Container ${runId} started with IP ${ip}, host port ${hostPort}`);
        return { container: runContainer, ip, hostPort };
    }
    /**
     * Get logs from a running container
     */
    async getLogs(runId) {
        const entry = this.containers.get(runId);
        if (!entry) {
            throw new Error(`Container not found for run ${runId}`);
        }
        const logs = await entry.container.logs({
            stdout: true,
            stderr: true,
            timestamps: false,
        });
        return logs.toString();
    }
    /**
     * Check if container is healthy by IP
     */
    async isHealthy(ip) {
        try {
            const response = await fetch(`http://${ip}:3000`, {
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get container's internal URL
     */
    getInternalUrl(runId) {
        const entry = this.containers.get(runId);
        if (!entry)
            return null;
        return `http://${entry.ip}:3000`;
    }
    /**
     * Kill a running container
     */
    async killRun(runId) {
        const entry = this.containers.get(runId);
        if (!entry) {
            console.warn(`[Docker] Container ${runId} not found, already removed?`);
            return;
        }
        try {
            console.log(`[Docker] Killing container ${runId}`);
            await entry.container.stop({ t: 10 }).catch(() => { });
            await entry.container.kill().catch(() => { });
            await entry.container.remove({ force: true });
            const workspaceDir = `${this.workspaceBase}/${runId}`;
            await this.cleanupWorkspace(workspaceDir);
            this.containers.delete(runId);
            console.log(`[Docker] Container ${runId} killed and removed`);
        }
        catch (error) {
            console.error(`[Docker] Error killing container ${runId}:`, error.message);
            throw error;
        }
    }
    /**
     * Cleanup workspace directory
     */
    async cleanupWorkspace(dir) {
        try {
            await execAsync(`rm -rf ${dir}`);
            console.log(`[Docker] Cleaned up workspace: ${dir}`);
        }
        catch (error) {
            console.error(`[Docker] Failed to cleanup workspace ${dir}:`, error.message);
        }
    }
    /**
     * Get all active containers
     */
    getActiveContainers() {
        return Array.from(this.containers.keys());
    }
}
