/**
 * Port Allocator
 * Manages dynamic port assignment for Docker containers
 */
export class PortAllocator {
    minPort;
    maxPort;
    usedPorts;
    constructor(minPort = 3001, maxPort = 4000) {
        this.minPort = minPort;
        this.maxPort = maxPort;
        this.usedPorts = new Set();
    }
    /**
     * Allocate an available port
     */
    async allocate() {
        for (let port = this.minPort; port <= this.maxPort; port++) {
            if (!this.usedPorts.has(port)) {
                this.usedPorts.add(port);
                return port;
            }
        }
        throw new Error('No available ports');
    }
    /**
     * Release a port back to the pool
     */
    release(port) {
        this.usedPorts.delete(port);
    }
    /**
     * Get count of used ports
     */
    getUsedCount() {
        return this.usedPorts.size;
    }
    /**
     * Get available port count
     */
    getAvailableCount() {
        return this.maxPort - this.minPort + 1 - this.usedPorts.size;
    }
}
