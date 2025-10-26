# Process API Endpoint Format

All client-server calls flow through a single Next.js API route: `/api/process/[name]`. The `[name]` path segment encodes the logical API identifier using underscores.

## Naming Rules

- Define the canonical API name with slashes in `src/apis/*/index.ts`, e.g. `auth/me`.
- When issuing requests, replace `/` with `_` to build the URL: `auth/me` → `/api/process/auth_me`.
- The server converts underscores back to slashes before dispatching to handlers. This keeps existing API handler keys untouched.
- Use a **single** dynamic segment (`[name]`). Do not introduce additional path nesting or catch-all segments.

## Request Shape

```http
POST /api/process/<api_name_with_underscores>
Content-Type: application/json

{
  "params": { ... },
  "options": { ... } // optional; subject to the standard ApiOptions contract
}
```

- The request body no longer includes a `name` property. Only `params` and `options` are sent.
- `options.disableCache` defaults to `false` on the client; offline queue requests force it to `true` server-side.

## Examples

| API name      | URL                        | Notes |
|---------------|----------------------------|-------|
| `auth/me`     | `/api/process/auth_me`     | Fetch authenticated user |
| `auth/login`  | `/api/process/auth_login`  | Submit credentials |
| `todos/getAll`| `/api/process/todos_getAll`| Nested namespaces use additional underscores |
| `chat`        | `/api/process/chat`        | Single-segment names remain unchanged |

## TTS Usage Dashboard Endpoints

The dashboard fetches usage and error summaries for a selectable time window (30/60/90 days), and a compact recent records list (last 24h). Free Tier usage is always computed for the current calendar month.

### Names

- `getTtsUsageSummary`
- `getTtsUsageRecords`
- `getTtsErrorSummary`
- `getTtsErrorRecords` (heavy; typically not needed for the dashboard UI)

### Request Params

```json
// getTtsUsageSummary
{
  "params": { "rangeDays": 30 | 60 | 90 } // default 30
}

// getTtsErrorSummary
{
  "params": { "rangeDays": 30 | 60 | 90 } // default 30
}

// getTtsUsageRecords
{
  "params": { "lastHours": number } // default 24
}
```

### Response Highlights

```ts
// TtsUsageSummary (excerpt)
type TtsUsageSummary = {
  totalCost: number;
  totalCalls: number;
  totalTextLength: number;
  totalAudioLength: number;
  usageByProvider: Record<string, {...}>;
  usageByDay: Record<string, { totalCost: number; totalCalls: number }>;
  // Calendar-month only (independent of rangeDays)
  freeTierMonthUsage: {
    polly: { standard: number; neural: number; longform: number };
    google: { standard: number; neural2: number };
    elevenlabs: { total: number };
  };
};
```

### Usage Example (Client)

```ts
// Summary and errors for last 60 days; records for last 24 hours
await Promise.all([
  apiClient.call('getTtsUsageSummary', { rangeDays: 60 }),
  apiClient.call('getTtsErrorSummary', { rangeDays: 60 }),
  apiClient.call('getTtsUsageRecords', { lastHours: 24 }),
]);
```

## Migration Checklist

1. Update client utilities (`apiClient`, offline queue, workers) to transform names before calling `fetch`.
2. Move the Next.js API route to `src/pages/api/process/[name].ts` and delete `process.ts`.
3. Parse `req.query.name` server-side and replace underscores with slashes before dispatch.
4. Adjust rewrites (`next.config.ts`) so application rewrites skip `/api/*` routes.
5. Allow the new directory in lint rules (`eslint.config.mjs`).
6. Update documentation and tests to refer to the underscore-based path format.

Following this pattern keeps per-API code untouched while ensuring URLs remain cache-friendly and easy to trace.
