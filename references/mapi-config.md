# Runner configuration

The config is JSON and contains no credentials.

```json
{
  "accessTokenEnv": "OCEANENGINE_ACCESS_TOKEN",
  "steps": [
    {
      "name": "current-unit",
      "operation": "promotion.detail",
      "query": { "local_account_id": 123, "promotion_id": 456 },
      "assertions": [
        { "type": "equals", "path": "data.promotion_id", "expected": 456 }
      ]
    }
  ]
}
```

Each step has:

- `name`: unique result key.
- `operation`: key from `--list-operations`.
- `query`: GET query parameters. Arrays and objects are JSON-encoded.
- `body`: POST JSON body.
- `optional`: when true, a known unsupported result is recorded as `unsupported` instead of failing. Use only for capability probes, never for required writes.
- `assertions`: optional readback assertions.
- `includeData`: set `true` to retain full response data for material/detail inspection; otherwise only a compact summary is returned. A summary alone is not material-set verification.
- `readbackAttempts`: 1 by default; up to 3 for GET assertion failures after a successful write. Only the GET is repeated; POST cannot use this option above 1.
- `readbackDelayMs`: delay between assertion-driven GET retries, default 2000, allowed 0..10000. Stop after exhaustion and reconcile the already-created ID.

IDs larger than the JavaScript safe-integer range are parsed as strings, including in summary output. Keep expected assertion IDs as strings. To send an exact integer required by an API schema, use `{"$integer":"9007199254740993"}`; this works for body fields, top-level query parameters, and nested filter arrays. An ordinary digit-only string remains a string. Do not use `Number` to build long IDs. See [mapi-spreadsheet-placement.md](mapi-spreadsheet-placement.md) for homepage material payloads and grouping.

The runner does not automatically resume batches or resolve a previous step's returned ID. Save each successful mutation result before building dependent steps; never rerun a partly successful create config from the beginning. POST is submitted once and cannot be optional; uncertain writes require read-only reconciliation.

Assertions:

- `equals`: exact scalar or structural equality.
- `setEquals`: arrays compared after stable normalization and sorting.
- `empty`: value must be an empty array.
- `notEmpty`: value must be non-null and, for arrays/strings, non-empty.

Dot paths support array indexes, for example `data.list.0.promotion_id`.

For mutations, place a fresh official detail step before the POST and a new detail/report step after it. Configure exact assertions on account ID, project/unit name, material IDs, and counts.
