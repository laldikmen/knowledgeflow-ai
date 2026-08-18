import { parseOffice } from 'officeparser';

// File types officeparser can parse (binary office / PDF formats).
const OFFICE_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'];

// Plain-text formats we can read straight from the buffer (meeting transcripts, etc.).
const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'log', 'json', 'vtt', 'srt'];

const extensionOf = (fileName: string): string =>
  (fileName.split('.').pop() || '').toLowerCase();

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
