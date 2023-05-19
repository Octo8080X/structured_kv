import { assertEquals } from "https://deno.land/std@0.185.0/testing/asserts.ts";
import {
  decorateDataKey,
  decorateSystemKey,
  StructuredKv,
  unDecorateDataKey,
} from "./mod.ts";

Deno.test("decorateSystemKey", () => {
  assertEquals(decorateSystemKey(["A", "B"]), ["SYSTEM", "A"]);
  assertEquals(decorateSystemKey(["A", "B", "C"]), ["SYSTEM", "A", "B"]);
});

Deno.test("decorateDataKey", () => {
  assertEquals(decorateDataKey(["A", "B"]), ["DATA", "A", "v~B!v"]);
  assertEquals(decorateDataKey(["A", "B", "C"]), ["DATA", "A", "B", "v~C!v"]);
});

Deno.test("unDecorateDataKey", () => {
  assertEquals(unDecorateDataKey(["DATA", "A", "v~B!v"]), ["A", "B"]);
  assertEquals(unDecorateDataKey(["DATA", "A", "B", "v~C!v"]), ["A", "B", "C"]);
});

Deno.test("unDecorateDataKey", () => {
  assertEquals(unDecorateDataKey(["DATA", "A", "v~B!v"]), ["A", "B"]);
  assertEquals(unDecorateDataKey(["DATA", "A", "B", "v~C!v"]), ["A", "B", "C"]);
});

Deno.test("StructuredKv", async () => {
  const rawKv = await Deno.openKv(":memory:")
  const kv = new StructuredKv(rawKv);

  await kv.set(["A", "B"], "1");

  const entry = await kv.get(["A", "B"]);

  assertEquals(unDecorateDataKey(entry.key), ["A", "B"]);
  assertEquals(entry.value, "1");
  await rawKv.close();
});

Deno.test("StructuredKv#list", async (t) => {
  const rawKv = await Deno.openKv(":memory:")
  const kv = new StructuredKv(rawKv);

  await kv.set(["A", "B"], "1");
  await kv.set(["A", "B", "C1"], "ABC1");
  await kv.set(["A", "B", "C2"], "ABC2");
  await kv.set(["A", "B", "C2", "D"], "ABCD2");

  await t.step("list - 1", async () => {
    const iter = kv.list({ start: ["A", "B", ""], end: ["A", "B", "~"] });

    const entries = [];
    for await (const entry of iter) {
      entries.push(entry);
    }
    assertEquals(entries.length, 2);
  
    assertEquals(unDecorateDataKey(entries[0].key), ["A", "B", "C1"]);
    assertEquals(entries[0].value, "ABC1" );
    assertEquals(unDecorateDataKey(entries[1].key), ["A", "B", "C2"]);
    assertEquals(entries[1].value, "ABC2");
  });

  await t.step("list - 2", async () => {
    const iter = kv.list({ start: ["A", ""], end: ["A", "~"] });

    const entries = [];
    for await (const entry of iter) {
      entries.push(entry);
    }
    assertEquals(entries.length, 1);
  
    assertEquals(unDecorateDataKey(entries[0].key), ["A", "B"]);
    assertEquals(entries[0].value, "1" );
  });

  await rawKv.close();
});

Deno.test("StructuredKv#structure", async (t) => {
  const rawKv = await Deno.openKv(":memory:")
  const kv = new StructuredKv(rawKv);
  
  await t.step("structure - 1", async () => {
    await kv.set(["A", "B"], "1");
    await kv.set(["A", "B", "C1"], "ABC1");
    await kv.set(["A", "B", "C2"], "ABC2");
    await kv.set(["A", "B", "C2", "D"], "ABCD2");
  
    const structure = await kv.structure([]);
    assertEquals(structure["A"]._v, 1);
    assertEquals(structure["A"]["B"]._v, 2);
    assertEquals(structure["A"]["B"]["C2"]._v, 1);  
  });

  await t.step("structure - 2", async () => {
    await kv.delete(["A", "B"]);
    await kv.delete(["A", "B", "C1"]);
    await kv.delete(["A", "B", "C2"]);
    await kv.delete(["A", "B", "C2", "D"]);
  
    const structure = await kv.structure([]);
    assertEquals(structure, {});  
  });

  await rawKv.close();
});

Deno.test("StructuredKv#set", async (t) => {
  const rawKv = await Deno.openKv(":memory:")
  const kv = new StructuredKv(rawKv);

  await kv.set(["A", "B"], "1");
  
  const entry = await kv.get(["A", "B"]);
  assertEquals(entry.value, "1");

  const iter = await rawKv.list({prefix:[]});

  const entries = [];
  for await (const entry of iter) {
    entries.push(entry);
  }
  assertEquals(entries.length, 2);

  assertEquals(entries[0].key, ["DATA", "A", "v~B!v"]);
  assertEquals(entries[0].value, "1" );

  assertEquals(entries[1].key, ["SYSTEM", "A"]);
  assertEquals(entries[1].value, 1 );

  await rawKv.close();
});

Deno.test("StructuredKv#delete", async (t) => {
  const rawKv = await Deno.openKv(":memory:")
  const kv = new StructuredKv(rawKv);

  await kv.set(["A", "B"], "1");
  
  const entry = await kv.get(["A", "B"]);
  assertEquals(entry.value, "1");

  await kv.delete(["A", "B"]);

  const iter = await rawKv.list({prefix:[]});

  const entries = [];
  for await (const entry of iter) {
    entries.push(entry);
  }
  assertEquals(entries.length, 0);

  await rawKv.close();
});


