export const json = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
};

export const notFound = (res) => json(res, 404, { error: "Not found" });

export const withTimeout = async (operation, timeoutMs, label = "Request") => {
  const parsedTimeout = Number(timeoutMs);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return operation();
  }

  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${parsedTimeout}ms.`));
    }, parsedTimeout);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const createFetchSignal = (timeoutMs) => {
  const parsedTimeout = Number(timeoutMs);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return undefined;
  }

  return AbortSignal.timeout(parsedTimeout);
};

export const normalizeDomain = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

export const isAllowedDomain = (candidate, allowlist = []) => {
  const normalizedCandidate = normalizeDomain(candidate);
  if (!normalizedCandidate) {
    return false;
  }

  return allowlist
    .map((entry) => normalizeDomain(entry))
    .filter(Boolean)
    .some(
      (allowedDomain) =>
        normalizedCandidate === allowedDomain || normalizedCandidate.endsWith(`.${allowedDomain}`),
    );
};

export const readBody = async (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
