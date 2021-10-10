import { AsyncLocalStorage } from "async_hooks";

const ls = new AsyncLocalStorage<{ deps: Map<unknown, unknown>, once: Map<unknown, unknown> }>();

export const diDep = <T>(dep: T | string): T => {
  const store = ls.getStore();

  if (!store) {
    throw new Error('DI container not registered! Consider that you call "diInit" before');
  }

  const userDep = (store.deps as Map<T | string, T>).get(dep);

  if (typeof dep === "string" && userDep == null) {
    throw new Error(`Dependency with key ${dep} not registered!`);
  }

  return userDep ?? (dep as T);
};

export const diSet = <T>(dep: T, value: T extends string ? unknown : T) => {
  const store = ls.getStore();

  if (!store) {
    throw new Error('DI container not registered! Consider that you call "diInit" before');
  }

  store.deps.set(dep, value);
};

export const diInit = (cb: () => void) => {
  ls.run({ deps: new Map(), once: new Map() }, cb);
};

export const diOnce = <T extends Function>(fn: T): T => {
  return (function(this: unknown, ...args: unknown[]) {
    const store = ls.getStore();

    if (!store) {
      throw new Error('DI container not registered! Consider that you call "diInit" before');
    }

    return store.once.get(fn) ?? store.once.set(fn, fn.apply(this, args)).get(fn);
  }) as unknown as T
}
