# structured kv

structured Deno.kv.

# Usage

```typescript
import { StructuredKv, unDecorateDataKey } from "./mod.ts";

const rawKv = await Deno.openKv();
const kv = new StructuredKv(rawKv);

await kv.set(["A", "B"], "1");
await kv.set(["A", "B", "C1"], "ABC1");
await kv.set(["A", "B", "C2"], "ABC2");
await kv.set(["A", "B", "C2", "D"], "ABCD2");

const iter = kv.list({ start: ["A", "B", ""], end: ["A", "B", "~"] });

const entries = [];
for await (const entry of iter) {
  entries.push(entry);
}
console.log(entries.length);
// => 2

console.log(unDecorateDataKey(entries[0].key), entries[0].value);
// => [ "A", "B", "C1" ] ABC1

console.log(unDecorateDataKey(entries[1].key), entries[1].value);
// => [ "A", "B", "C2" ] ABC2

console.log(await kv.structure([]));
// => { A: { _v: 1, B: { _v: 2, C2: { _v: 1 } } } }
```
