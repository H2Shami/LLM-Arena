/**
 * Gateway Registry
 *
 * Manages run -> URL mappings for the reverse proxy (Caddy)
 * Stores internal Docker network URLs for each run
 */
export class GatewayRegistry {
    runToUrl;
    constructor() {
        this.runToUrl = new Map();
    }
    /**
     * Register a run with its internal URL
     */
    registerUrl(runId, url) {
        this.runToUrl.set(runId, url);
        console.log(`[Gateway] Registered run ${runId} -> ${url}`);
    }
    /**
     * Unregister a run
     */
    unregister(runId) {
        this.runToUrl.delete(runId);
        console.log(`[Gateway] Unregistered run ${runId}`);
    }
    /**
     * Resolve a run ID to its internal URL
     */
    resolve(runId) {
        return this.runToUrl.get(runId) || null;
    }
    /**
     * Get all registered runs
     */
    getAll() {
        return new Map(this.runToUrl);
    }
    /**
     * Get count of registered runs
     */
    size() {
        return this.runToUrl.size;
    }
}
