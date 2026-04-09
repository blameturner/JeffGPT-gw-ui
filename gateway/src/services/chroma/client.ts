import { env } from '../../env.js';

/**
 * Minimal Chroma HTTP client for the gateway's "flush chunks" action on
 * enrichment sources. We deliberately keep this to one operation — the harness
 * owns all ingestion; the gateway only ever needs to remove by-url on flush.
 *
 * Chroma's REST contract:
 *   GET  /api/v1/collections/{name} → {id, name, ...}
 *   POST /api/v1/collections/{id}/delete  body: {where: {...}}
 *
 * We look up the collection id by name, then POST a metadata filter matching
 * the source URL. Missing collections are silently skipped — fresh deployments
 * may not have ingested every category yet.
 */

const SCRAPED_COLLECTIONS = [
  'scraped_documentation',
  'scraped_news',
  'scraped_competitive',
  'scraped_regulatory',
  'scraped_research',
  'scraped_security',
  'scraped_model_releases',
] as const;

async function getCollectionId(name: string): Promise<string | null> {
  const res = await fetch(`${env.CHROMA_URL}/api/v1/collections/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`chroma get collection ${name} failed: ${res.status}`);
  }
  const body = (await res.json()) as { id?: string };
  return body.id ?? null;
}

async function deleteFromCollection(collectionId: string, url: string): Promise<void> {
  const res = await fetch(
    `${env.CHROMA_URL}/api/v1/collections/${collectionId}/delete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: { url } }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`chroma delete failed: ${res.status} ${detail}`);
  }
}

/**
 * Delete every chunk with metadata.url === `url` across all scraped_*
 * collections. Returns the number of collections we successfully hit (useful
 * only for logging).
 */
export async function deleteByUrl(url: string): Promise<number> {
  let hit = 0;
  for (const name of SCRAPED_COLLECTIONS) {
    try {
      const id = await getCollectionId(name);
      if (!id) continue;
      await deleteFromCollection(id, url);
      hit += 1;
    } catch (err) {
      // One bad collection shouldn't abort the flush — log and continue.
      console.error(`[chroma] deleteByUrl ${name} failed`, err);
    }
  }
  return hit;
}
