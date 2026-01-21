# LLM Vibe Coding Arena

A competitive platform where multiple LLMs race to build the best Next.js website from a single prompt. Watch them code in real-time, compare their outputs side-by-side, and see which AI builds the most impressive site.

## Features

- **Multi-Model Competition**: Run up to 6 different LLMs simultaneously (GPT-4, Claude, Gemini, etc.)
- **Live Previews**: Each generated site runs in an isolated Docker container with live iframe previews
- **Side-by-Side Comparison**: View all generated sites in a responsive grid layout
- **Build Logs**: Inspect npm install, build, and runtime logs for each model
- **Screenshots**: Automatic desktop and mobile screenshot capture
- **Production Builds**: All sites are built with `npm run build` and served with `npm start` (no dev mode)
- **Security First**: Sandboxed Docker containers with resource limits and network isolation

## Architecture

```
┌─────────────────────────────────────────────┐
│  Next.js Main App (Port 3000)               │
│  - Prompt submission                        │
│  - Arena view with iframes                  │
│  - Real-time status updates                 │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Orchestrator API (Port 8080)               │
│  - Docker runtime management                │
│  - Port allocation (3001-4000)              │
│  - Run lifecycle (build → start → capture)  │
│  - Gateway registry                         │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Docker Containers (Dynamic Ports)          │
│  - Container A: run_abc123 → Port 3042     │
│  - Container B: run_def456 → Port 3043     │
│  - Container C: run_ghi789 → Port 3044     │
│  Each running: npm ci && npm build && start │
└─────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js**: v20 or higher
- **Docker**: Installed and running
- **npm**: v10 or higher
- **Helicone API Key**: For LLM observability and routing (recommended)
- Or individual API keys:
  - OpenAI API key
  - Anthropic API key
  - Google AI API key
  - xAI API key
  - Meta API key
  - DeepSeek API key

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Helicone (recommended - provides observability for all LLM calls)
HELICONE_API_KEY="sk-helicone-..."

# Or individual API keys
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."
XAI_API_KEY="..."
META_API_KEY="..."
DEEPSEEK_API_KEY="..."

# Preview domain (for local dev)
NEXT_PUBLIC_PREVIEW_DOMAIN="preview.localhost:3000"

# Orchestrator (will run on port 8080)
ORCHESTRATOR_URL="http://localhost:8080"
```

### 3. Start the Main App

```bash
npm run dev
```

The main app will be available at: **http://localhost:3000**

### 4. Start the Orchestrator

In a new terminal:

```bash
cd orchestrator
npm install
npm run dev
```

The orchestrator will be available at: **http://localhost:8080**

You should see:

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         LLM Vibe Coding Arena - Orchestrator                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

  Status: Running
  Port: 8080
  Port Range: 3001 - 4000
  Max Concurrent Runs: 1000

  Ready to orchestrate! 🚀
```

### 5. You're Ready!

1. Open **http://localhost:3000** in your browser
2. Enter a prompt (e.g., "Build a landing page for a coffee shop")
3. Select models to compete (try all 6!)
4. Click "Start the Competition"
5. Watch the magic happen! ✨

## Architecture Notes

### In-Memory Storage

This project uses **in-memory storage** instead of a database because:

- ✅ Sessions are ephemeral (containers die after 30min)
- ✅ No need to persist historical data
- ✅ Faster than database queries
- ✅ Simpler architecture (one less dependency)
- ✅ State loss on restart is acceptable (containers would be killed anyway)

All session and run data is stored in `lib/store.ts` using JavaScript Maps.

### Helicone Integration

Helicone provides:
- **Unified API**: Call all LLM providers through one interface
- **Observability**: Track costs, latency, and token usage
- **Caching**: Reduce redundant API calls
- **Rate limiting**: Prevent abuse
- **Analytics**: Compare model performance

Instead of integrating 6+ different LLM SDKs, we use Helicone as a proxy.

## Project Structure

```
llm_arena/
├── app/
│   ├── page.tsx                  # Home page with prompt submission
│   ├── arena/[sessionId]/
│   │   └── page.tsx              # Arena view with side-by-side previews
│   ├── api/
│   │   └── sessions/
│   │       ├── route.ts          # POST /api/sessions - Create session
│   │       └── [sessionId]/
│   │           └── route.ts      # GET /api/sessions/:id - Get session
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── PreviewFrame.tsx          # Iframe component with security sandboxing
│   ├── RunCard.tsx               # Individual model run display
│   └── StatusBadge.tsx           # Status indicator component
├── lib/
│   ├── store.ts                  # In-memory storage (sessions & runs)
│   └── utils.ts                  # Utility functions
├── types/
│   └── index.ts                  # TypeScript type definitions
├── orchestrator/                 # TO BE BUILT
│   ├── index.ts                  # Main orchestrator API
│   ├── docker-runtime.ts         # Docker container management
│   ├── port-allocator.ts         # Port allocation service
│   └── llm-client.ts             # LLM API integrations
└── package.json
```

## How It Works

### 1. User Submits Prompt

1. User enters a prompt (e.g., "Build a landing page for a coffee shop")
2. User selects which LLMs to compete (e.g., GPT-4, Claude, Gemini)
3. App creates a new `Session` in memory with multiple `Run` records (one per model)

### 2. Orchestrator Processes Runs

For each run:

1. **LLM Generation**: Call the LLM API with the prompt to generate Next.js code
2. **Workspace Creation**: Create a temporary directory (`/tmp/opencode/{runId}`)
3. **Write Files**: Write all generated files (package.json, pages/, etc.)
4. **Build Phase** (with network):
   - `npm ci` - Install dependencies
   - `npm run build` - Build the Next.js app
5. **Runtime Phase** (no network):
   - Allocate port (e.g., 3042)
   - Start Docker container
   - Run `npm run start` (bind to allocated port)
   - Wait for health check
6. **Screenshot Capture**: Use Playwright to capture desktop/mobile screenshots
7. **Register**: Add run to gateway registry so previews can be accessed

### 3. User Views Arena

- Arena page polls `/api/sessions/{sessionId}` every 3 seconds
- Displays all runs in a grid with:
  - Live status badges (queued → installing → building → ready)
  - Preview iframes (or screenshots with "View Live" button)
  - Build logs (expandable)
  - Duration timers

### 4. Iframe Security

Previews are embedded with strict sandboxing:

```tsx
<iframe
  src="https://{runId}.preview.example.com"
  sandbox="allow-scripts allow-forms allow-modals allow-popups"
  // NO allow-same-origin (critical!)
/>
```

This prevents:
- Access to parent window
- Cookie/localStorage sharing
- Top-level navigation
- Malicious code execution affecting main app

## In-Memory Data Structures

### Session

```typescript
interface Session {
  id: string;              // Unique session ID (nanoid)
  prompt: string;          // User's prompt
  runs: Run[];             // Array of runs
  createdAt: Date;         // When session was created
  updatedAt: Date;         // Last updated timestamp
}
```

### Run

```typescript
interface Run {
  id: string;              // Unique run ID (also used for preview subdomain)
  sessionId: string;       // Parent session
  model: string;           // Model name (e.g., "gpt-4o")
  provider: ModelProvider; // openai | anthropic | google | xai | meta | deepseek
  status: RunStatus;       // Current status
  port?: number;           // Allocated port number
  containerId?: string;    // Docker container ID
  internalUrl?: string;    // Internal URL (e.g., http://localhost:3042)
  publicUrl?: string;      // Public URL (e.g., https://run_abc.preview.example.com)
  error?: string;          // Error message if failed
  // Logs
  logsNpmCi?: string;
  logsNpmBuild?: string;
  logsNpmStart?: string;
  logsError?: string;
  // Screenshots
  screenshotDesktop?: string;
  screenshotMobile?: string;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

Storage is managed by `lib/store.ts` using JavaScript Maps for fast lookups.

## Run Lifecycle States

1. **queued**: Run created, waiting to start
2. **installing**: Running `npm ci`
3. **building**: Running `npm run build`
4. **starting**: Running `npm run start`
5. **healthy**: Server responded to health check
6. **capturing**: Taking screenshots
7. **ready**: Ready for preview
8. **failed**: Build or start failed
9. **terminated**: Shut down due to timeout/idle

## Development Roadmap

### Phase 1: Main App ✅ (COMPLETED)

- [x] Next.js app setup with TypeScript
- [x] In-memory store (no database needed!)
- [x] Prompt submission UI
- [x] Arena comparison view with iframes
- [x] API routes (sessions, runs)
- [x] Real-time polling (3s interval)

### Phase 2: Orchestration Layer ✅ (COMPLETED)

- [x] Orchestrator API server (Express on port 8080)
- [x] Helicone LLM client (6 providers: OpenAI, Anthropic, Google, xAI, Meta, DeepSeek)
- [x] Docker runtime manager (two-phase: build + run)
- [x] Port allocator (dynamic port allocation)
- [x] Run lifecycle manager
- [x] Gateway registry API
- [x] Health check system
- [x] Build pipeline (npm ci → build → start)

### Phase 3: Preview & Gateway (NEXT)

- [ ] Caddy reverse proxy setup
- [ ] Wildcard SSL for `*.preview.example.com`
- [ ] Screenshot capture service (Playwright)
- [ ] Mobile screenshot support

### Phase 4: Production Optimizations

- [ ] Resource monitoring dashboard
- [ ] Build queue (limit concurrent builds to 3 users)
- [ ] Idle timeout enforcement (5-30 min)
- [ ] Cleanup automation
- [ ] Error recovery & retry logic
- [ ] Log streaming (replace polling with SSE)
- [ ] Cost tracking per run

## Resource Requirements

### Single Machine (32 cores, 64GB RAM)

- **Target capacity**: 5-7 concurrent users
- **Per user**: 6 runs (one per model)
- **Per run during build**:
  - Memory: ~2.5GB
  - CPU: ~1.5 cores
  - Duration: ~2 minutes
- **Per run during runtime**:
  - Memory: ~800MB
  - CPU: ~0.2 cores
  - Duration: Until idle (5-30 minutes)

### Cost Estimate

- **VM**: ~$800-1000/month (AWS c6i.8xlarge or similar)
- **LLM API calls**: ~$0.10-0.50 per session (6 models)
- **Storage**: ~$50/month (screenshots, logs)

## Security Considerations

1. **Container Isolation**: Each run in separate Docker container with dropped capabilities
2. **Network Isolation**: Build phase has network, runtime phase blocked
3. **Resource Limits**: 4GB memory, 2 CPU cores per container
4. **Code Validation**: Pre-flight checks for malicious patterns
5. **Iframe Sandboxing**: Strict sandbox without `allow-same-origin`
6. **No Secrets**: No .env files or credentials mounted
7. **Read-Only Runtime**: Workspace becomes read-only after build

## Troubleshooting

### Docker Connection Issues

```bash
# Ensure Docker is running
docker ps

# Test Docker connectivity
docker run hello-world
```

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Build Failures

Check logs in the arena view. Common issues:
- Missing `package-lock.json` (LLM didn't generate it)
- Invalid `package.json`
- TypeScript errors in generated code
- Missing required files (pages/index.tsx, etc.)

## Contributing

This is an experimental project. Contributions welcome!

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

MIT

## Next Steps

Now that the main Next.js app is complete, the next major task is building the **Orchestrator Layer** which handles:

1. Docker container lifecycle management
2. LLM API integrations
3. Build pipeline execution
4. Port allocation
5. Gateway registry

See `orchestrator/README.md` (to be created) for orchestrator-specific documentation.
