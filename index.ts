import { AsyncLocalStorage } from "async_hooks";

export const _als = new AsyncLocalStorage<{ deps: Map<unknown, unknown>; once: Map<unknown, unknown>, [k: string]: unknown }>();

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
  return _als.run({ deps: new Map(), once: new Map() }, cb);
};

export const diOnce = <T extends Function>(fn: T): T => {
  const onceFn = function (this: unknown, ...args: unknown[]) {
    const store = storeOrError();
    return store.once.get(onceFn) ?? store.once.set(onceFn, fn.apply(this, args)).get(onceFn);
  } as unknown as T;
  return onceFn;
};

export const diOnceSet = <T>(fn: (...args: any[]) => T, value: T) => {
  const store = storeOrError();
  store.once.set(fn, value);
};

const storeOrError = () => {
  const store = _als.getStore();

  if (store == null) {
    throw new Error('DI container not registered! Consider, that you call "diInit" before');
  }

  return store;
};

export const diExists = () => (_als.getStore() == null) === false;
