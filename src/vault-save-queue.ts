/**
 * Serializes encrypted journal writes. New edits replace queued snapshots, but never
 * interrupt an in-flight write. A flush resolves only when no newer edits remain.
 */
export class VaultSaveQueue<T> {
  private staged: T | null = null;
  private running: Promise<void> | null = null;

  constructor(private readonly write: (snapshot: T) => Promise<void>) {}

  stage(snapshot: T): void {
    this.staged = snapshot;
  }

  get dirty(): boolean {
    return this.staged !== null || this.running !== null;
  }

  async flush(): Promise<void> {
    // Another caller may already be draining. After it finishes, recheck for
    // edits staged at the boundary before reporting a successful flush.
    while (this.staged !== null || this.running !== null) {
      if (this.running !== null) {
        await this.running;
        continue;
      }
      const work = this.drain();
      this.running = work;
      try {
        await work;
      } finally {
        if (this.running === work) this.running = null;
      }
    }
  }

  private async drain(): Promise<void> {
    while (this.staged !== null) {
      const snapshot = this.staged;
      this.staged = null;
      try {
        await this.write(snapshot);
      } catch (error) {
        // A more recent edit wins. Otherwise retain the failed snapshot for retry.
        this.staged ??= snapshot;
        throw error;
      }
    }
  }
}
