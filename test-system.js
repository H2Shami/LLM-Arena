#!/usr/bin/env node

/**
 * Integration Test for LLM Vibe Coding Arena
 *
 * Verifies:
 * 1. Main app is running
 * 2. Orchestrator is running
 * 3. Can create a session
 * 4. System responds correctly
 */

// Using native fetch (Node.js 18+)

const MAIN_APP_URL = 'http://localhost:3000';
const ORCHESTRATOR_URL = 'http://localhost:8080';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkMainApp() {
  try {
    const response = await fetch(MAIN_APP_URL, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      logSuccess('Main app is running on port 3000');
      return true;
    }
  } catch (error) {
    logError('Main app is not running');
    logInfo('Start it with: npm run dev');
    return false;
  }
}

async function checkOrchestrator() {
  try {
    const response = await fetch(`${ORCHESTRATOR_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      logSuccess('Orchestrator is running on port 8080');
      const stats = await response.json();
      logInfo(`  - Available ports: ${stats.ports?.available || 'unknown'}`);
      logInfo(`  - Active containers: ${stats.containers?.active || 0}`);
      return true;
    }
  } catch (error) {
    logError('Orchestrator is not running');
    logInfo('Start it with: cd orchestrator && npm run dev');
    return false;
  }
}

async function checkDocker() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('docker ps');
    logSuccess('Docker is running');
    return true;
  } catch (error) {
    logError('Docker is not running');
    logInfo('Make sure Docker Desktop is running');
    return false;
  }
}

async function checkAPIKeys() {
  const hasHelicone = process.env.HELICONE_API_KEY;
  const hasOpenAI = process.env.OPENAI_API_KEY;
  const hasAnthropic = process.env.ANTHROPIC_API_KEY;

  if (hasHelicone) {
    logSuccess('Helicone API key is set');
    return true;
  } else if (hasOpenAI || hasAnthropic) {
    logSuccess('Provider API keys are set');
    return true;
  } else {
    logWarning('No API keys found in environment');
    logInfo('Add HELICONE_API_KEY (or provider keys) to .env file');
    logInfo('The system will work without them, but LLM calls will fail');
    return false;
  }
}

async function testCreateSession() {
  try {
    logInfo('Creating test session...');

    const response = await fetch(`${MAIN_APP_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Build a simple Hello World Next.js page with a centered heading',
        models: [
          { provider: 'openai', model: 'gpt-4o' }
        ]
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      const data = await response.json();
      const { sessionId } = data;
      logSuccess(`Session created: ${sessionId}`);
      return sessionId;
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create session');
    }
  } catch (error) {
    logError('Failed to create session');
    console.error(error.message);
    return null;
  }
}

async function testGetSession(sessionId) {
  try {
    const response = await fetch(`${MAIN_APP_URL}/api/sessions/${sessionId}`, {
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const session = await response.json();
      logSuccess('Session retrieved successfully');
      logInfo(`  - Prompt: ${session.prompt.substring(0, 50)}...`);
      logInfo(`  - Runs: ${session.runs.length}`);

      session.runs.forEach(run => {
        const statusColor = run.status === 'ready' ? colors.green :
                           run.status === 'failed' ? colors.red :
                           colors.yellow;
        log(`    - ${run.model}: ${run.status}`, statusColor);
      });

      return session;
    }
  } catch (error) {
    logError('Failed to retrieve session');
    console.error(error.message);
    return null;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('  LLM Vibe Coding Arena - System Test', colors.blue);
  console.log('='.repeat(60) + '\n');

  // Step 1: Check prerequisites
  log('Step 1: Checking Prerequisites', colors.blue);
  const mainAppOk = await checkMainApp();
  const orchestratorOk = await checkOrchestrator();
  const dockerOk = await checkDocker();
  const apiKeysOk = await checkAPIKeys();

  console.log('');

  if (!mainAppOk || !orchestratorOk) {
    logError('\nCritical services are not running!');
    logInfo('Please start both services and try again.');
    process.exit(1);
  }

  if (!dockerOk) {
    logError('\nDocker is required but not running!');
    logInfo('Please start Docker and try again.');
    process.exit(1);
  }

  // Step 2: Test API integration
  log('Step 2: Testing API Integration', colors.blue);
  const sessionId = await testCreateSession();

  if (!sessionId) {
    logError('\nFailed to create session!');
    logInfo('Check that both services can communicate.');
    process.exit(1);
  }

  console.log('');
  await sleep(2000);

  // Step 3: Verify session retrieval
  log('Step 3: Verifying Session Retrieval', colors.blue);
  const session = await testGetSession(sessionId);

  if (!session) {
    logError('\nFailed to retrieve session!');
    process.exit(1);
  }

  console.log('');

  // Summary
  console.log('='.repeat(60));
  logSuccess('ALL TESTS PASSED! ✨');
  console.log('='.repeat(60));
  console.log('');

  logInfo('Next steps:');
  log('  1. Open http://localhost:3000 in your browser', colors.cyan);
  log('  2. Enter a prompt and select models', colors.cyan);
  log('  3. Watch the competition!', colors.cyan);
  console.log('');

  if (!apiKeysOk) {
    logWarning('Note: Add API keys to .env for full functionality');
  }

  logInfo(`Test session ID: ${sessionId}`);
  logInfo(`View at: ${MAIN_APP_URL}/arena/${sessionId}`);
  console.log('');
}

// Run tests
main().catch(error => {
  console.error('\n' + '='.repeat(60));
  logError('TEST FAILED');
  console.error('='.repeat(60));
  console.error(error);
  process.exit(1);
});
