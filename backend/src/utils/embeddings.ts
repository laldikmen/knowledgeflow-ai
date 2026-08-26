import * as AWS from 'aws-sdk';
import { query } from '../db/connection';

// Semantic retrieval uses Amazon Titan Text Embeddings V2 (1024-dim, normalized)
// on Bedrock. Vectors are stored in the `document_chunks` table (pgvector) and
// queried by cosine distance for the AI chat's hybrid retrieval.
const BEDROCK_REGION = process.env.BEDROCK_REGION || process.env.S3_REGION || 'eu-central-1';
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
export const EMBEDDING_DIMS = 1024;

const bedrockRuntime = new AWS.BedrockRuntime({ region: BEDROCK_REGION });

/** Embed one piece of text and return its 1024-dim vector. */
export async function embedText(text: string): Promise<number[]> {
  const input = (text || '').slice(0, 40000); // Titan v2 caps input length; guard it.
  const res = await bedrockRuntime
    .invokeModel({
      modelId: EMBEDDING_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: input, dimensions: EMBEDDING_DIMS, normalize: true }),
    })
    .promise();
  const parsed = JSON.parse(new TextDecoder().decode(res.body as Uint8Array));
  return parsed.embedding as number[];
}

/** Format a vector for a pgvector column/parameter: "[0.1,0.2,...]". */
export const toVectorLiteral = (vec: number[]): string => `[${vec.join(',')}]`;

/**
 * Split text into overlapping chunks (~500-700 tokens each) on paragraph/sentence
 * boundaries where possible, so each embedding covers a coherent span.
 */
export function chunkText(text: string, maxChars = 2500, overlap = 250): string[] {
  const clean = (text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Prefer to break on blank lines, then sentence ends, then hard-cut.
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const para = slice.lastIndexOf('\n\n');
      const sentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
      const breakAt = para > maxChars * 0.5 ? para : sentence > maxChars * 0.5 ? sentence + 1 : -1;
      if (breakAt > 0) end = start + breakAt;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/**
 * Chunk a document's text, embed each chunk, and (re)store the chunks for that
 * document. Replaces any existing chunks so re-processing stays idempotent.
 */
export async function embedAndStoreChunks(documentId: number, text: string): Promise<number> {
  const chunks = chunkText(text);
  await query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);
  if (chunks.length === 0) return 0;

  for (let i = 0; i < chunks.length; i++) {
    const vec = await embedText(chunks[i]);
    await query(
      `INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [documentId, i, chunks[i], toVectorLiteral(vec)]
    );
  }
  return chunks.length;
}
