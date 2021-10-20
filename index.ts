import { AsyncLocalStorage } from "async_hooks";

const ls = new AsyncLocalStorage<{ deps: Map<unknown, unknown>, once: Map<unknown, unknown> }>();

export const diDep = <T>(dep: T | string): T => {
  const store = storeOrError();
  const userDep = (store.deps as Map<T | string, T>).get(dep);

  if (typeof dep === "string" && userDep == null) {
    throw new Error(`Dependency with key ${dep} not registered!`);
  }

  return userDep ?? (dep as T);
};

export const diSet = <T>(dep: T, value: T extends string ? unknown : T) => {
  const store = storeOrError();
  store.deps.set(dep, value);
};

export const diInit = <T>(cb: () => T) => {
  return ls.run({ deps: new Map(), once: new Map() }, cb);
};

export const diOnce = <T extends Function>(fn: T): T => {
  return (function(this: unknown, ...args: unknown[]) {
    const store = storeOrError();
    return store.once.get(fn) ?? store.once.set(fn, fn.apply(this, args)).get(fn);
  }) as unknown as T
}

const storeOrError = () => {
  const store = ls.getStore();

  if (store == null) {
    throw new Error('DI container not registered! Consider, that you call "diInit" before');
  }

  return store;
}

export const diExists = () => (ls.getStore() == null) === false
