/** Text-Chunking fuer die Suchindex-Pipeline. */

/** Heading-basiert mit Fallback auf Fixed 400W, 75 Overlap */
export function chunkText(text: string): string[] {
  return chunkByHeadings(text);
}

export function chunkFixed(text: string, size: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk);
    if (i + size >= words.length) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

export function chunkByHeadings(text: string): string[] {
  const sections = text.split(/(?=^#{2,3}\s)/m);
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount < 50 && buffer) {
      buffer += '\n\n' + trimmed;
      continue;
    }
    if (buffer) {
      if (buffer.split(/\s+/).length > 500) {
        chunks.push(...chunkFixed(buffer, 400, 75));
      } else { chunks.push(buffer); }
      buffer = '';
    }
    if (wordCount > 500) {
      const headingMatch = trimmed.match(/^(#{2,3}\s+.+)\n/);
      const heading = headingMatch ? headingMatch[1]! : '';
      const body = heading ? trimmed.slice(heading.length).trim() : trimmed;
      for (const sub of chunkFixed(body, 400, 75)) {
        chunks.push(heading ? `${heading}\n${sub}` : sub);
      }
    } else { buffer = trimmed; }
  }

  if (buffer) {
    const bw = buffer.split(/\s+/).length;
    if (bw > 500) chunks.push(...chunkFixed(buffer, 400, 75));
    else if (bw > 20) chunks.push(buffer);
  }

  return chunks.length > 0 ? chunks : chunkFixed(text, 400, 75);
}

export async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
