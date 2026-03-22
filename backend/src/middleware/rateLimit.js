function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || "").trim();
  }

  return String(req.ip || req.socket?.remoteAddress || "unknown").trim();
}

export function createRateLimiter({
  windowMs,
  max,
  message,
  keyPrefix,
  keyGenerator
}) {
  const hitsByKey = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const rawKey = keyGenerator ? keyGenerator(req) : getClientIp(req);
    const key = `${keyPrefix || "rate"}:${String(rawKey || "unknown")}`;

    const existingHits = hitsByKey.get(key) || [];
    const recentHits = existingHits.filter((timestamp) => now - timestamp < windowMs);

    if (recentHits.length >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - recentHits[0])) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: message || "Zu viele Anfragen, bitte später erneut versuchen." });
    }

    recentHits.push(now);
    hitsByKey.set(key, recentHits);

    // Opportunistic cleanup to keep memory usage bounded.
    if (hitsByKey.size > 1000) {
      for (const [mapKey, timestamps] of hitsByKey.entries()) {
        const validTimestamps = timestamps.filter((timestamp) => now - timestamp < windowMs);
        if (validTimestamps.length === 0) {
          hitsByKey.delete(mapKey);
        } else {
          hitsByKey.set(mapKey, validTimestamps);
        }
      }
    }

    return next();
  };
}
