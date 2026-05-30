export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);

  await runConcurrentWorkers(items, concurrency, async (item, index) => {
    results[index] = await mapper(item);
  });

  return results;
}

export async function mapSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);

  await runConcurrentWorkers(items, concurrency, async (item, index) => {
    try {
      results[index] = { status: "fulfilled", value: await mapper(item) };
    } catch (reason) {
      results[index] = { status: "rejected", reason };
    }
  });

  return results;
}

async function runConcurrentWorkers<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.max(0, Math.min(Math.floor(concurrency), items.length));

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}
