export function weatherRefreshIsDue({loadedAt = 0, refreshStartedAt = 0, refreshInterval, now = Date.now()}) {
  const latestRefresh = Math.max(loadedAt, refreshStartedAt);
  return !latestRefresh || now - latestRefresh >= refreshInterval;
}
