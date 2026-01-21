import { ModelProvider, GeneratedCode, LLMResponse } from './types.js';
import { createOpencode } from '@opencode-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * OpenCode-based LLM Client
 *
 * Uses OpenCode SDK to handle LLM calls through Helicone,
 * then extracts generated files for Docker execution.
 *
 * CRITICAL: We change to a temporary directory before calling OpenCode
 * to prevent it from overwriting the orchestrator files.
 */

const SYSTEM_PROMPT = `You are an expert Next.js developer. You will be given a prompt to build a Next.js website.

CRITICAL REQUIREMENTS:
1. Generate a COMPLETE, PRODUCTION-READY Next.js app from scratch
2. MUST include these files:
   - package.json with ALL dependencies (see below)
   - app/page.tsx (main page)
   - app/layout.tsx
   - app/globals.css (with Tailwind directives)
   - tailwind.config.ts
   - postcss.config.mjs
   - next.config.ts

3. package.json MUST include these dependencies:
   {
     "dependencies": {
       "next": "^14.2.0",
       "react": "^18.2.0",
       "react-dom": "^18.2.0"
     },
     "devDependencies": {
       "typescript": "^5.0.0",
       "@types/node": "^20.0.0",
       "@types/react": "^18.2.0",
       "@types/react-dom": "^18.2.0",
       "tailwindcss": "^3.4.0",
       "postcss": "^8.4.0",
       "autoprefixer": "^10.4.0"
     }
   }

4. Use Next.js 14 App Router (not Pages Router)
5. Use TypeScript
6. Use Tailwind CSS for styling (MUST include tailwindcss in devDependencies!)
7. Make it fully responsive (mobile + desktop)
8. Add beautiful, modern design

IMPORTANT:
- Do NOT use external APIs or services
- Do NOT use environment variables
- Do NOT use remote images (use placeholder divs or emojis instead)
- Build a COMPLETE, WORKING app that can run with: npm ci && npm run build && npm run start
- ALWAYS include tailwindcss, postcss, and autoprefixer in devDependencies

Create ALL files in the current directory. Make it impressive! This is a competition.`;

export class OpencodeClient {
  private heliconeApiKey: string;

  constructor() {
    this.heliconeApiKey = process.env.HELICONE_API_KEY || '';

    if (!this.heliconeApiKey) {
      console.warn('[OpencodeClient] HELICONE_API_KEY not set');
    }
  }

  /**
   * Generate Next.js code from a prompt using OpenCode SDK
   */
  async generateCode(
    prompt: string,
    provider: ModelProvider,
    model: string
  ): Promise<LLMResponse> {
    console.log(`[OpencodeClient] Generating code with ${provider}/${model} via OpenCode`);

    // Create a temporary workspace directory
    const workspaceDir = `/tmp/opencode-workspace-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await fs.mkdir(workspaceDir, { recursive: true });

    // Save the original cwd
    const originalCwd = process.cwd();

    try {
      // CRITICAL: Change to the temp workspace before creating OpenCode
      // This prevents OpenCode from writing to the orchestrator directory
      process.chdir(workspaceDir);
      console.log(`[OpencodeClient] Changed to workspace: ${workspaceDir}`);

      // Create an OpenCode instance with random port to avoid conflicts
      console.log(`[OpencodeClient] Creating OpenCode instance`);
      const { client, server } = await createOpencode({
        port: 0, // Use random available port
      });

      try {
        // Create a new session
        console.log(`[OpencodeClient] Creating session`);
        const sessionResult = await client.session.create({
          body: {
            title: `${provider}-${model}-${Date.now()}`,
          },
        });

        if (!sessionResult.data) {
          throw new Error('Failed to create session: no data returned');
        }

        const session = sessionResult.data;
        console.log(`[OpencodeClient] Session created: ${session.id}`);

        // Build the full prompt
        const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\nUSER REQUEST:\n${prompt}`;

        // Send the prompt
        console.log(`[OpencodeClient] Sending prompt to session ${session.id}`);
        const promptResult = await client.session.prompt({
          path: { id: session.id },
          body: {
            parts: [{ type: 'text', text: fullPrompt }],
          },
        });

        console.log(`[OpencodeClient] Prompt completed for session ${session.id}`);

        // Wait a moment for files to be written
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Read all files from the workspace
        const files = await this.readWorkspaceFiles(workspaceDir);
        console.log(`[OpencodeClient] Generated ${Object.keys(files).length} files`);

        // Close the server
        server.close();

        return {
          code: { files },
          model: `${provider}/${model}`,
        };
      } finally {
        // Always close the server
        try {
          server.close();
        } catch (e) {
          // Ignore
        }
      }
    } finally {
      // CRITICAL: Always change back to the original directory
      process.chdir(originalCwd);
      console.log(`[OpencodeClient] Restored cwd to: ${originalCwd}`);
    }
  }

  /**
   * Read all files from a workspace directory
   */
  private async readWorkspaceFiles(dir: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};

    async function walkDir(currentDir: string, baseDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        // Skip node_modules, .next, .git directories
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath, baseDir);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files[relativePath] = content;
          } catch (e) {
            console.warn(`[OpencodeClient] Could not read file: ${relativePath}`);
          }
        }
      }
    }

    await walkDir(dir, dir);
    return files;
  }

  /**
   * Validate that the generated code has required files
   */
  validateCode(code: GeneratedCode): void {
    const requiredFiles = ['package.json'];
    const missingFiles = requiredFiles.filter(f => !code.files[f]);

    if (missingFiles.length > 0) {
      throw new Error(`Missing required file: ${missingFiles.join(', ')}`);
    }

    // Validate package.json has required scripts
    try {
      const packageJson = JSON.parse(code.files['package.json']);
      if (!packageJson.scripts?.build || !packageJson.scripts?.start) {
        throw new Error('package.json must have build and start scripts');
      }
    } catch (e: any) {
      if (e.message.includes('package.json must have')) {
        throw e;
      }
      throw new Error('Invalid package.json format');
    }
  }
}
