const SYSTEM_KEY = "SYSTEM" as const;
const DATA_KEY = "DATA" as const;

export interface StructuredKvNode {
  [key: string]: StructuredKvNode;
  _v?: number;
}

export function decorateSystemKey(key: string[]): string[] {
  return [SYSTEM_KEY, ...key.slice(0, -1)];
}

export function decorateDataKey(key: string[]): string[] {
  const decoratedKey = !!key && key.length > 0
    ? [DATA_KEY, ...key.slice(0, key.length - 1)]
    : [DATA_KEY];
  decoratedKey.push(`v~${key[key.length - 1]}!v`);
  return decoratedKey;
}

export function unDecorateDataKey(key: string[]): string[] {
  return key.slice(1, key.length).join(",").replace(/(v\~)|(!v$)/g, "").split(
    ",",
  );
}

export class StructuredKv {
  #kv: Deno.Kv;
  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }
  list<T = unknown>(
    selector: Deno.KvListSelector,
    options?: Deno.KvListOptions,
  ): Deno.KvListIterator<T> {
    const localSelector = {
      ...selector,
      start: decorateDataKey(selector.start!),
      end: decorateDataKey(selector.end!),
    };
    return this.#kv.list(localSelector, options);
  }

  async structure(
    selector: string[],
  ): Promise<StructuredKvNode> {
    const localSelector = {
      prefix: [SYSTEM_KEY, ...selector],
      start: [SYSTEM_KEY, ...selector],
    };

    const structureIter = this.#kv.list(localSelector);
    const entries = [];

    for await (const entry of structureIter) {
      entries.push(entry);
    }

    const structuredKeys: any = {};
    entries.forEach((entry) => {
      const currentKey: string[] = [];
      let currentObj = structuredKeys;
      entry.key.forEach((k: string, i: number) => {
        currentKey.push(entry.key);
        if (!currentObj[k]) {
          currentObj[k] = {};
        }
        if ((entry.key.length - 1) === i) {
          currentObj[k]._v = entry.value;
        }
        currentObj = currentObj[k];
      });
    });

    return { ...structuredKeys["SYSTEM"] };
  }

  async set(key: Deno.KvKey, value: unknown): Promise<Deno.KvCommitResult> {
    const systemKey = decorateSystemKey(key);
    const systemEntry = await this.#kv.get<number>(systemKey);
    const systemValue = systemEntry?.value ? systemEntry.value + 1 : 1;

    const dataKey = decorateDataKey(key);
    const result = await this.#kv
      .atomic()
      .check({ key: dataKey, versionstamp: null })
      .set(systemKey, systemValue)
      .set(dataKey, value)
      .commit();

    if (result.ok) return true;

    return this.#kv
      .atomic()
      .set(dataKey, value)
      .commit();
  }

  async get<T = unknown>(
    key: Deno.KvKey,
    options?: { consistency?: KvConsistencyLevel },
  ): Promise<Deno.KvEntryMaybe<T>> {
    return this.#kv.get<T>(decorateDataKey(key));
  }
  async delete(key: Deno.KvKey) {
    const systemKey = decorateSystemKey(key);
    const systemEntry = await this.#kv.get<number>(systemKey);

    if (!systemEntry) {
      return await this.#kv
        .atomic()
        .delete(decorateDataKey(key))
        .commit();
    }

    if (systemEntry.value - 1 === 0) {
      return await this.#kv
        .atomic()
        .delete(systemKey)
        .delete(decorateDataKey(key))
        .commit();
    }

    return await this.#kv
      .atomic()
      .set(systemKey, systemEntry.value - 1)
      .delete(decorateDataKey(key))
      .commit();
  }
}
