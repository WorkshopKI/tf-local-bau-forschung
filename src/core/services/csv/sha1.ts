export async function sha1Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  let buf: ArrayBuffer;
  if (data instanceof Blob) {
    buf = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    buf = copy.buffer;
  } else {
    buf = data;
  }
  const digest = await crypto.subtle.digest('SHA-1', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return hex;
}
