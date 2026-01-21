/**
 * Port Allocator
 * Manages dynamic port assignment for Docker containers
 */
export class PortAllocator {
  private minPort: number;
  private maxPort: number;
  private usedPorts: Set<number>;

  constructor(minPort: number = 3001, maxPort: number = 4000) {
    this.minPort = minPort;
    this.maxPort = maxPort;
    this.usedPorts = new Set();
  }

  /**
   * Allocate an available port
   */
  async allocate(): Promise<number> {
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
  release(port: number): void {
    this.usedPorts.delete(port);
  }

  /**
   * Get count of used ports
   */
  getUsedCount(): number {
    return this.usedPorts.size;
  }

  /**
   * Get available port count
   */
  getAvailableCount(): number {
    return this.maxPort - this.minPort + 1 - this.usedPorts.size;
  }
}
