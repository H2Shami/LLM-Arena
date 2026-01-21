# Orchestrator Service

The orchestrator is the **brain** of the LLM Vibe Coding Arena. It handles:

- Calling LLMs (via Helicone) to generate Next.js code
- Managing Docker containers for isolated execution
- Building and running generated apps
- Health checks and lifecycle management
- Gateway registry for Caddy reverse proxy

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Orchestrator API (Express on port 8080)                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  LLM Client (Helicone)                          │   │
│  │  - Unified API for 6 providers                  │   │
│  │  - OpenAI, Anthropic, Google, xAI, Meta, Deep  │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker Runtime                                  │   │
│  │  - Two-phase execution (build/run)              │   │
│  │  - Port allocation (3001-4000)                  │   │
│  │  - Container lifecycle management               │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Run Manager                                     │   │
│  │  - Orchestrates complete run lifecycle          │   │
│  │  - Updates main app with status                 │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Gateway Registry                                │   │
│  │  - Maps run_id → localhost:port                 │   │
│  │  - Called by Caddy for routing                  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Run Lifecycle

1. **Main app creates session** → Calls `POST /api/sessions/:id/start`
2. **Orchestrator fetches session** → Gets prompt and runs from main app
3. **For each run:**
   1. Call LLM to generate Next.js code
   2. Validate generated code (check for required files)
   3. **Phase 1: Build** (with network)
      - Create Docker container
      - Run `npm ci` (install dependencies)
      - Run `npm run build` (build Next.js app)
   4. **Phase 2: Run** (without network)
      - Start production server `npm run start`
      - Bind to allocated port (e.g., 3042)
   5. **Health check** (30 attempts, 2s interval)
   6. **Update main app** → Status = "ready"
   7. **Register with gateway** → Caddy can now route traffic

## Two-Phase Execution

### Why Two Phases?

- **Build phase needs network** for `npm install`
- **Runtime phase should be isolated** (no outbound network)
- This prevents malicious generated code from exfiltrating data

### Phase 1: Build Container (Temporary)

```typescript
Container: build-{runId}
Network: bridge (allows npm registry)
Command: npm ci && npm run build
Resources: 4GB RAM, 2 CPU cores
Workspace: /workspace (read-write)
Lifecycle: Removed after build completes
```

### Phase 2: Runtime Container (Long-lived)

```typescript
Container: run-{runId}
Network: bridge (only for port mapping, no external access)
Command: npm run start
Resources: 2GB RAM, 1 CPU core
Workspace: /workspace (read-only!)
Port: 3000 → dynamic host port (3001-4000)
Lifecycle: Runs until idle timeout or manual kill
```

## API Endpoints

### Start Session

```bash
POST /api/sessions/:sessionId/start

# Starts all runs for a session
# Called automatically by main app when user submits prompt
```

### Start Single Run

```bash
POST /api/runs/:runId/start
Body: {
  "run": { ... },
  "prompt": "Build a landing page..."
}
```

### Gateway Resolution (Called by Caddy)

```bash
GET /gateway/resolve/:runId

# Returns:
{
  "url": "http://localhost:3042",
  "runId": "abc123"
}
```

### Kill Run

```bash
DELETE /api/runs/:runId

# Stops container, releases port, cleans up workspace
```

### Health Check

```bash
GET /health

# Returns:
{
  "status": "healthy",
  "uptime": 1234,
  "ports": {
    "total": 1000,
    "allocated": 12,
    "available": 988
  },
  "gateway": {
    "total": 12,
    "ready": 8,
    "building": 4
  },
  "containers": {
    "active": 12
  }
}
```

## Environment Variables

```env
# Helicone (recommended)
HELICONE_API_KEY="sk-helicone-..."

# Or individual provider keys
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_AI_API_KEY=""
XAI_API_KEY=""
META_API_KEY=""
DEEPSEEK_API_KEY=""

# Main app URL (for callbacks)
MAIN_APP_URL="http://localhost:3000"

# Orchestrator settings
ORCHESTRATOR_PORT=8080
PORT_RANGE_START=3001
PORT_RANGE_END=4000
WORKSPACE_BASE="/tmp/opencode"
```

## Running

### Development

```bash
cd orchestrator
npm install
npm run dev
```

### Production

```bash
cd orchestrator
npm run build
npm start
```

## File Structure

```
orchestrator/
├── src/
│   ├── index.ts              # Main Express server
│   ├── llm-client.ts         # Helicone LLM integration
│   ├── docker-runtime.ts     # Docker container management
│   ├── port-allocator.ts     # Dynamic port allocation
│   ├── run-manager.ts        # Run lifecycle orchestration
│   ├── gateway-registry.ts   # Route mapping for Caddy
│   └── types.ts              # TypeScript types
├── package.json
├── tsconfig.json
└── README.md
```

## Security

### Container Isolation

- Each run in separate Docker container
- Dropped all Linux capabilities (`CapDrop: ALL`)
- No new privileges (`no-new-privileges:true`)
- Read-only workspace in runtime phase
- PID limit to prevent fork bombs
- Memory/CPU limits enforced

### Network Isolation

- Build phase: Access to npm registry only
- Runtime phase: No outbound network access
- Port binding for inbound only (Caddy → container)

### Code Validation

Before running, we check:
- `package.json` exists and has required scripts
- `package-lock.json` exists
- `app/page.tsx` exists
- No `.env` files
- No external API calls in generated code

## Resource Limits

### Per Run

| Phase | Memory | CPU | Network | Duration |
|-------|--------|-----|---------|----------|
| Build | 4GB | 2 cores | Yes (npm only) | ~2 min |
| Runtime | 2GB | 1 core | No | Until timeout |

### Total Capacity

With default port range (3001-4000):
- **Max concurrent runs:** 1000
- **Realistic capacity:** 30-50 (depends on VM resources)

## Troubleshooting

### Docker connection failed

```bash
# Check Docker is running
docker ps

# Check socket permissions
ls -la /var/run/docker.sock
```

### LLM API errors

```bash
# Check API keys are set
echo $HELICONE_API_KEY

# Check orchestrator logs
tail -f orchestrator/logs/orchestrator.log
```

### Port exhaustion

```bash
# Check active ports
curl http://localhost:8080/stats

# Manually release ports by killing runs
curl -X DELETE http://localhost:8080/api/runs/{runId}
```

## Monitoring

### Stats Endpoint

```bash
curl http://localhost:8080/stats
```

Returns:
- Port usage (allocated/available)
- Gateway status (ready/building/failed)
- Active runs

### Docker Stats

```bash
# View all containers
docker ps --filter name=run-

# View container stats (CPU, memory)
docker stats $(docker ps -q --filter name=run-)
```

## Next Steps

1. ✅ Main app (Next.js)
2. ✅ Orchestrator
3. ⏳ Caddy reverse proxy setup
4. ⏳ Screenshot capture (Playwright)
5. ⏳ Production deployment

See main README for overall architecture.
