import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"
import queueCache from "@opennextjs/cloudflare/overrides/queue/queue-cache"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"

// Bindings used here are declared in wrangler.jsonc:
// R2 (NEXT_INC_CACHE_R2_BUCKET), D1 (NEXT_TAG_CACHE_D1), Durable Object (NEXT_CACHE_DO_QUEUE).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: queueCache(doQueue, {
    regionalCacheTtlSec: 5,
    waitForQueueAck: true,
  }),
  tagCache: d1NextTagCache,
})
