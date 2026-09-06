import { ProviderHealthRecord, ProviderHealthStatus } from './types';

export class ProviderHealthManager {
  private records: Map<string, ProviderHealthRecord> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();

  registerProvider(id: string, name: string, isConfigured: boolean): void {
    this.records.set(id, {
      id,
      name,
      status: isConfigured ? 'healthy' : 'unconfigured',
      isConfigured,
      isAvailable: isConfigured,
      failureCount: 0,
    });
    this.latencyHistory.set(id, []);
  }

  updateConfigured(id: string, isConfigured: boolean): void {
    const existing = this.records.get(id);
    if (existing) {
      existing.isConfigured = isConfigured;
      if (!isConfigured) {
        existing.status = 'unconfigured';
        existing.isAvailable = false;
      } else if (existing.status === 'unconfigured') {
        existing.status = 'healthy';
        existing.isAvailable = true;
      }
    }
  }

  canAttempt(id: string): boolean {
    const record = this.records.get(id);
    if (!record || !record.isConfigured) {
      return false;
    }

    const now = Date.now();
    if (record.cooldownUntil && record.cooldownUntil > now) {
      return false;
    }

    // If cooldown has expired, permit a single retry probe
    if (record.cooldownUntil && record.cooldownUntil <= now) {
      record.status = 'degraded';
      record.cooldownUntil = undefined;
      return true;
    }

    return record.status === 'healthy' || record.status === 'degraded';
  }

  recordSuccess(id: string, latencyMs: number): void {
    const record = this.records.get(id);
    if (!record) return;

    record.failureCount = 0;
    record.lastSuccess = Date.now();
    record.cooldownUntil = undefined;
    record.status = 'healthy';
    record.isAvailable = true;
    record.lastError = undefined;

    const history = this.latencyHistory.get(id) || [];
    history.push(latencyMs);
    if (history.length > 20) history.shift();
    this.latencyHistory.set(id, history);

    const sum = history.reduce((a, b) => a + b, 0);
    record.averageLatencyMs = Math.round(sum / history.length);
  }

  recordFailure(id: string, error: any): void {
    const record = this.records.get(id);
    if (!record) return;

    const now = Date.now();
    record.failureCount += 1;
    record.lastFailure = now;

    const errMessage = (error?.message || String(error || 'Unknown error')).slice(0, 300);
    record.lastError = errMessage;

    const isRateLimit =
      /429|resource_exhausted|rate limit|quota/i.test(errMessage) ||
      error?.status === 429;
    const isAuthFailed =
      /401|403|unauthorized|invalid api key|forbidden|permission_denied/i.test(errMessage) ||
      error?.status === 401 ||
      error?.status === 403;
    const isTimeout = /timeout|timed out|abort|econnreset/i.test(errMessage);
    const isModelUnavailable = /404|not found|model unavailable|503|service unavailable/i.test(errMessage);

    if (isAuthFailed) {
      record.status = 'unavailable';
      record.isAvailable = false;
      // 5 minutes cooldown for auth errors so server logs aren't flooded
      record.cooldownUntil = now + 300_000;
    } else if (isRateLimit) {
      record.status = 'cooldown';
      record.isAvailable = false;
      // 60 seconds cooldown for rate limit
      record.cooldownUntil = now + 60_000;
    } else if (isModelUnavailable) {
      record.status = 'degraded';
      record.isAvailable = false;
      // 45 seconds cooldown
      record.cooldownUntil = now + 45_000;
    } else if (isTimeout || record.failureCount >= 2) {
      record.status = 'cooldown';
      record.isAvailable = false;
      // 30 seconds cooldown
      record.cooldownUntil = now + 30_000;
    } else {
      record.status = 'degraded';
    }
  }

  getRecord(id: string): ProviderHealthRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): ProviderHealthRecord[] {
    return Array.from(this.records.values());
  }

  getSafeStatusSummary(): Record<string, {
    status: ProviderHealthStatus;
    available: boolean;
    configured: boolean;
    avgLatencyMs?: number;
  }> {
    const summary: Record<string, any> = {};
    for (const [id, record] of this.records.entries()) {
      summary[id] = {
        name: record.name,
        status: record.status,
        available: this.canAttempt(id),
        configured: record.isConfigured,
        avgLatencyMs: record.averageLatencyMs,
      };
    }
    return summary;
  }
}

export const healthManager = new ProviderHealthManager();
