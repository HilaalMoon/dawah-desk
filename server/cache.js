const cacheBuckets = new Map();

const getBucket = (bucketName) => {
  if (!cacheBuckets.has(bucketName)) {
    cacheBuckets.set(bucketName, new Map());
  }

  return cacheBuckets.get(bucketName);
};

const purgeExpiredEntries = (bucket) => {
  const now = Date.now();
  for (const [key, entry] of bucket.entries()) {
    if (entry.expiresAt <= now) {
      bucket.delete(key);
    }
  }
};

export const readCachedValue = (bucketName, key, { enabled = true } = {}) => {
  if (!enabled) {
    return null;
  }

  const bucket = getBucket(bucketName);
  purgeExpiredEntries(bucket);

  const entry = bucket.get(key);
  if (!entry) {
    return null;
  }

  return entry.value;
};

export const writeCachedValue = (bucketName, key, value, { enabled = true, ttlMs = 5 * 60 * 1000 } = {}) => {
  if (!enabled) {
    return value;
  }

  const bucket = getBucket(bucketName);
  bucket.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1000, ttlMs),
  });

  return value;
};

export const clearCacheBucket = (bucketName) => {
  cacheBuckets.delete(bucketName);
};
