/**
 * Gateway Registry
 *
 * Manages run -> URL mappings for the reverse proxy (Caddy)
 * Stores internal Docker network URLs for each run
 */
export class GatewayRegistry {
  private runToUrl: Map<string, string>;

  constructor() {
    this.runToUrl = new Map();
  }

  /**
   * Register a run with its internal URL
   */
  registerUrl(runId: string, url: string): void {
    this.runToUrl.set(runId, url);
    console.log(`[Gateway] Registered run ${runId} -> ${url}`);
  }

  /**
   * Unregister a run
   */
  unregister(runId: string): void {
    this.runToUrl.delete(runId);
    console.log(`[Gateway] Unregistered run ${runId}`);
  }

  /**
   * Resolve a run ID to its internal URL
   */
  resolve(runId: string): string | null {
    return this.runToUrl.get(runId) || null;
  }

  /**
   * Get all registered runs
   */
  getAll(): Map<string, string> {
    return new Map(this.runToUrl);
  }

  /**
   * Get count of registered runs
   */
  size(): number {
    return this.runToUrl.size;
  }
}
