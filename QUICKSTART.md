# 🚀 Quick Start Guide

Get the LLM Vibe Coding Arena running in under 5 minutes!

## Prerequisites

✅ **Node.js 20+** installed
✅ **Docker Desktop** running
✅ **Helicone API key** (or individual provider API keys)
✅ **Caddy** installed (optional for previews)

---

## Step 1: Install Dependencies

```bash
# Main app
npm install

# Orchestrator
cd orchestrator && npm install && cd ..
```

---

## Step 2: Configure Environment

```bash
# Copy example env
cp .env.example .env

# Edit .env and add your API keys
# Minimum required:
# HELICONE_API_KEY="sk-helicone-..."
```

---

## Step 3: Start Services

You need **3 terminals** (or use tmux/screen):

### Terminal 1: Main App
```bash
npm run dev
# ✓ Running on http://localhost:3000
```

### Terminal 2: Orchestrator
```bash
cd orchestrator && npm run dev
# ✓ Running on http://localhost:8080
```

### Terminal 3: Caddy (Optional)
```bash
# Install Caddy first:
# macOS: brew install caddy
# Linux: sudo apt install caddy

caddy run
# ✓ Running on http://main.localhost
```

---

## Step 4: Test the System

```bash
# Run integration test
node test-system.js
```

You should see:
```
✓ Main app is running on port 3000
✓ Orchestrator is running on port 8080
✓ Docker is running
✓ Helicone API key is set
✓ Session created: abc123
✓ ALL TESTS PASSED! ✨
```

---

## Step 5: Use the Arena

### Without Caddy (Direct Access)

1. Open **http://localhost:3000**
2. Enter a prompt: *"Build a landing page for a coffee shop"*
3. Select models (try all 6!)
4. Click **"Start the Competition"**
5. Watch the arena update in real-time

**Note:** Previews will use port-based URLs (http://localhost:3042)

### With Caddy (Production-like)

1. Open **http://main.localhost**
2. Same as above
3. Previews will use: **http://{run_id}.preview.localhost**

---

## What Happens Next?

When you click "Start the Competition":

1. **Main app** creates a session with 6 runs
2. **Orchestrator** receives the session
3. For each model:
   - Calls LLM via Helicone
   - Generates Next.js code
   - Creates Docker container
   - Runs `npm ci && npm run build && npm run start`
   - Health checks the server
   - Marks as ready
4. **Browser** polls every 3 seconds for updates
5. **You** see live previews as they complete!

---

## Troubleshooting

### "Docker is not running"
```bash
# Start Docker Desktop
# Then verify:
docker ps
```

### "Port 3000 already in use"
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
```

### "Orchestrator won't start"
```bash
# Check port 8080 is free
lsof -ti:8080 | xargs kill -9

# Check logs for errors
cd orchestrator && npm run dev
```

### "Previews show 503"
```bash
# Check orchestrator health
curl http://localhost:8080/health

# Check specific run
curl http://localhost:8080/gateway/resolve/{run_id}
```

### "LLM calls failing"
```bash
# Verify API key is set
echo $HELICONE_API_KEY

# Or check .env file
cat .env | grep HELICONE
```

---

## File Structure

```
llm_arena/
├── app/                    # Next.js main app (Port 3000)
├── orchestrator/           # Orchestration service (Port 8080)
├── components/             # React components
├── lib/                    # Utils & in-memory store
├── test-system.js          # Integration test
├── Caddyfile               # Reverse proxy config
└── README.md               # Full documentation
```

---

## Next Steps

### Customize Models

Edit `app/page.tsx`:

```typescript
const AVAILABLE_MODELS = [
  { provider: "openai", model: "gpt-4o", name: "GPT-4o", enabled: true },
  { provider: "anthropic", model: "claude-sonnet-4", name: "Claude Sonnet", enabled: true },
  // Add more...
];
```

### Adjust Resource Limits

Edit `orchestrator/src/docker-runtime.ts`:

```typescript
HostConfig: {
  Memory: 4 * 1024 * 1024 * 1024,  // Change to 2GB for lighter loads
  NanoCpus: 2 * 1e9,               // Change to 1 core
}
```

### Add More Ports

Edit `.env`:

```env
PORT_RANGE_START=3001
PORT_RANGE_END=5000  # Support 2000 concurrent runs!
```

---

## Production Deployment

See [README.md](README.md) for:
- Multi-machine setup
- K8s deployment
- SSL certificates
- Monitoring
- Cost optimization

---

## Getting Help

- **Documentation**: [README.md](README.md)
- **Caddy Setup**: [CADDY_SETUP.md](CADDY_SETUP.md)
- **Orchestrator**: [orchestrator/README.md](orchestrator/README.md)
- **Issues**: GitHub Issues (if applicable)

---

## Example Session

Here's what a successful run looks like:

```bash
$ node test-system.js

============================================================
  LLM Vibe Coding Arena - System Test
============================================================

Step 1: Checking Prerequisites
✓ Main app is running on port 3000
✓ Orchestrator is running on port 8080
  - Available ports: 1000
  - Active containers: 0
✓ Docker is running
✓ Helicone API key is set

Step 2: Testing API Integration
ℹ Creating test session...
✓ Session created: abc123

Step 3: Verifying Session Retrieval
✓ Session retrieved successfully
  - Prompt: Build a simple Hello World Next.js page...
  - Runs: 1
    - gpt-4o: queued

============================================================
✓ ALL TESTS PASSED! ✨
============================================================

Next steps:
  1. Open http://localhost:3000 in your browser
  2. Enter a prompt and select models
  3. Watch the competition!

Test session ID: abc123
View at: http://localhost:3000/arena/abc123
```

---

🎉 **You're all set!** Start coding and watch LLMs compete!
