import { createOpencode } from '@opencode-ai/sdk';
import { promises as fs } from 'fs';
/**
 * OpenCode-based LLM Client
 *
 * Uses OpenCode SDK to handle LLM calls through Helicone.
 * Only generates page.tsx - the rest comes from the template.
 *
 * Model selection is done via the `model` parameter in session.prompt()
 */
const SYSTEM_PROMPT = `You are an expert Next.js developer. Generate ONLY the code for app/page.tsx.

REQUIREMENTS:
1. Use Next.js 14 App Router with TypeScript
2. Use Tailwind CSS for all styling
3. Make it fully responsive (mobile + desktop)
4. Create beautiful, modern UI
5. Use "use client" directive if you need interactivity (useState, useEffect, onClick handlers)

CONSTRAINTS:
- Do NOT use external APIs, fetch calls, or environment variables
- Do NOT use next/image with remote URLs (use placeholder divs or emojis instead)
- Do NOT import components from other files - keep everything in one file
- Do NOT add comments explaining the code

RESPONSE FORMAT:
Return ONLY the TypeScript/React code. No markdown, no explanations, no code fences.
Start directly with "use client" (with quotes!) or "export default function".
The "use client" directive MUST be: "use client" (with double quotes on its own line).

Make it impressive - this is a competition!`;
export class LLMClient {
    constructor() {
        // OpenCode uses HELICONE_API_KEY from environment
        if (!process.env.HELICONE_API_KEY) {
            console.warn('[LLMClient] HELICONE_API_KEY not set - LLM calls will fail');
        }
    }
    /**
     * Generate page.tsx code from a prompt using OpenCode SDK
     */
    async generateCode(prompt, provider, model) {
        console.log(`[LLMClient] Generating code with ${provider}/${model} via OpenCode`);
        // Create a temporary workspace directory
        const workspaceDir = `/tmp/opencode-workspace-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await fs.mkdir(workspaceDir, { recursive: true });
        // Save the original cwd
        const originalCwd = process.cwd();
        try {
            // Change to the temp workspace before creating OpenCode
            // This prevents OpenCode from writing to the orchestrator directory
            process.chdir(workspaceDir);
            console.log(`[LLMClient] Changed to workspace: ${workspaceDir}`);
            // Create an OpenCode instance
            console.log(`[LLMClient] Creating OpenCode instance`);
            const { client, server } = await createOpencode({
                port: 0, // Use random available port
            });
            try {
                // Create a new session
                console.log(`[LLMClient] Creating session`);
                const sessionResult = await client.session.create({
                    body: {
                        title: `${provider}-${model}-${Date.now()}`,
                    },
                });
                if (!sessionResult.data) {
                    throw new Error('Failed to create session: no data returned');
                }
                const session = sessionResult.data;
                console.log(`[LLMClient] Session created: ${session.id}`);
                // Build the full prompt
                const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\nUSER REQUEST:\n${prompt}`;
                // Send the prompt with model selection
                console.log(`[LLMClient] Sending prompt to session ${session.id} with model ${provider}/${model}`);
                const promptResult = await client.session.prompt({
                    path: { id: session.id },
                    body: {
                        model: {
                            providerID: provider,
                            modelID: model,
                        },
                        parts: [{ type: 'text', text: fullPrompt }],
                    },
                });
                console.log(`[LLMClient] Prompt completed for session ${session.id}`);
                // Log the full result for debugging
                console.log(`[LLMClient] Result data:`, JSON.stringify(promptResult.data, null, 2).substring(0, 500));
                // Extract code from the response
                let pageCode = '';
                if (promptResult.data?.parts) {
                    console.log(`[LLMClient] Found ${promptResult.data.parts.length} parts`);
                    for (const part of promptResult.data.parts) {
                        console.log(`[LLMClient] Part type: ${part.type}`);
                        if (part.type === 'text' && 'text' in part) {
                            pageCode += part.text;
                        }
                    }
                }
                else {
                    console.log(`[LLMClient] No parts in response`);
                }
                if (!pageCode) {
                    console.log(`[LLMClient] No text found. Full result:`, JSON.stringify(promptResult, null, 2).substring(0, 1000));
                    throw new Error('No text response from OpenCode');
                }
                // Clean the code
                pageCode = this.cleanCode(pageCode);
                console.log(`[LLMClient] Generated page.tsx (${pageCode.length} chars)`);
                // Build the files object - only page.tsx is generated
                const files = {
                    'app/page.tsx': pageCode,
                };
                return {
                    code: { files },
                    model: `${provider}/${model}`,
                };
            }
            finally {
                // Always close the server
                try {
                    server.close();
                }
                catch (e) {
                    // Ignore
                }
            }
        }
        finally {
            // Always change back to the original directory
            process.chdir(originalCwd);
            console.log(`[LLMClient] Restored cwd to: ${originalCwd}`);
            // Clean up the workspace
            try {
                await fs.rm(workspaceDir, { recursive: true, force: true });
            }
            catch (e) {
                // Ignore cleanup errors
            }
        }
    }
    /**
     * Clean up LLM response - remove markdown fences and fix common issues
     */
    cleanCode(code) {
        // Remove markdown code fences
        code = code.replace(/^```(?:typescript|tsx|jsx|javascript)?\n?/gm, '');
        code = code.replace(/```$/gm, '');
        // Trim whitespace
        code = code.trim();
        // Fix "use client" without quotes (common LLM mistake)
        code = code.replace(/^use client$/m, '"use client"');
        code = code.replace(/^'use client'$/m, '"use client"');
        return code;
    }
    /**
     * Validate that the generated code looks like valid React/Next.js
     */
    validateCode(code) {
        const pageCode = code.files['app/page.tsx'];
        if (!pageCode) {
            throw new Error('Missing app/page.tsx');
        }
        if (!pageCode.includes('export default') && !pageCode.includes('export default function')) {
            throw new Error('page.tsx must have a default export');
        }
    }
}
