/**
 * Rate limit configurations per route group.
 * Applied via route-level config.rateLimit in each route file.
 *
 * Summary:
 *   auth/register:  3 req / 1 hour  / per IP
 *   auth/login:     5 req / 1 min   / per IP
 *   auth/recover:   3 req / 1 hour  / per IP
 *   sync/push:    100 req / 1 min   / per userId
 *   sync/pull:     60 req / 1 min   / per userId
 *   admin/*:       30 req / 1 min   / per userId
 *   standard:     60 req / 1 min   / per userId (badges, inbox)
 *   global:       200 req / 1 min   / per IP (fallback)
 *
 * Rate limit key generators:
 *   - Default (IP-based): used for unauthenticated routes
 *   - User-based: keyGenerator extracts userId from JWT for authenticated routes
 */

export const rateLimitConfigs = {
  register: { max: 3, timeWindow: '1 hour' },
  login: { max: 5, timeWindow: '1 minute' },
  recover: { max: 3, timeWindow: '1 hour' },
  syncPush: { max: 100, timeWindow: '1 minute', keyGenerator: (req) => req.user?.sub },
  syncPull: { max: 60, timeWindow: '1 minute', keyGenerator: (req) => req.user?.sub },
  admin: { max: 30, timeWindow: '1 minute', keyGenerator: (req) => req.user?.sub },
  standard: { max: 60, timeWindow: '1 minute', keyGenerator: (req) => req.user?.sub },
  global: { max: 200, timeWindow: '1 minute' },
};
