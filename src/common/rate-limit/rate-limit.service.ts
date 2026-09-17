import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Simple fixed-window counter (close enough to the "token bucket" the spec
 * names, and much simpler to reason about correctly). Keyed by whatever
 * the caller wants — normally `login:<email>` and `login-ip:<ip>` checked
 * together, so both a targeted attack on one account and a spray attack
 * from one IP get caught.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Returns true if the action is allowed, false if the limit has been
   * exceeded for the current window.
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    return count <= limit;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`ratelimit:${key}`);
  }
}
