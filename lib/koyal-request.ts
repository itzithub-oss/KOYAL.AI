/** Read a request body with a hard streaming byte limit before parsing it. */
export async function readLimitedRequest(request: Request, maxBytes: number): Promise<Request> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }
  if (!request.body) return new Request(request.url, { method: request.method, headers: request.headers });
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("REQUEST_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bytes,
  });
}

export function requestClientIp(request: Request): string {
  const candidate = request.headers.get("x-real-ip")
    || request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-forwarded-for")
    || "unknown";
  return candidate.split(",")[0].trim().slice(0, 100) || "unknown";
}
