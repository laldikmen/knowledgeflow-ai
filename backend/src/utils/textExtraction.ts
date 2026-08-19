import { parseOffice } from 'officeparser';

// File types officeparser can parse (binary office / PDF formats).
const OFFICE_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'];

// Plain-text formats we can read straight from the buffer (meeting transcripts, etc.).
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'log', 'json', 'vtt', 'srt'];

// Everything we can actually extract text from.
export const SUPPORTED_EXTENSIONS = [...OFFICE_EXTENSIONS, ...TEXT_EXTENSIONS];

const extensionOf = (fileName: string): string =>
  (fileName.split('.').pop() || '').toLowerCase();

/**
 * Can we extract text from this file? Used to reject unsupported uploads up
 * front, so a file never silently lands with no analysable text.
 */
export function isSupportedFile(fileName: string, mimeType?: string): boolean {
  const ext = extensionOf(fileName);
  if (SUPPORTED_EXTENSIONS.includes(ext)) return true;
  // Allow any text/* payload even with an unusual extension.
  if (mimeType && mimeType.startsWith('text/')) return true;
  return false;
}

/**
 * Extract plain text from an uploaded file buffer.
 * - PDF / Word / PowerPoint / Excel -> parsed with officeparser
 * - .txt / transcripts / csv / etc.  -> decoded as UTF-8
 * Returns '' when the type is unsupported or parsing yields nothing.
 * Never throws — extraction failures must not fail the upload.
 */
export async function extractText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
): Promise<string> {
  const ext = extensionOf(fileName);

  try {
    if (OFFICE_EXTENSIONS.includes(ext)) {
      const result = await parseOffice(buffer);
      const text =
        typeof (result as any)?.toText === 'function'
          ? (result as any).toText()
          : (result as any)?.content ?? '';
      return String(text).trim();
    }

    if (
      TEXT_EXTENSIONS.includes(ext) ||
      (mimeType && mimeType.startsWith('text/'))
    ) {
      return buffer.toString('utf-8').trim();
    }

    // Unknown type: attempt a best-effort UTF-8 decode.
    return buffer.toString('utf-8').trim();
  } catch (error) {
    console.error(`Text extraction failed for ${fileName}:`, error);
    return '';
  }
}
