import { AsyncLocalStorage } from "async_hooks";

const ls = new AsyncLocalStorage<{ deps: Map<unknown, unknown> }>();

export const diDep = <T>(dep: T | string): T => {
  const store = ls.getStore();

  if (!store) {
    throw new Error('Dependency container not registered! Consider that you call "diInit" before');
  }

  const userDep = (store.deps as Map<T | string, T>).get(dep);

  if (typeof dep === "string" && userDep == null) {
    throw new Error(`Dependency with key ${dep} not registered!`);
  }

  return userDep ?? (dep as T);
};

export const diSet = (dep: unknown, value: unknown) => {
  const store = ls.getStore();

  if (!store) {
    throw new Error('Dependency container not registered! Consider that you call "diInit" before');
  }

  store.deps.set(dep, value);
};

export const diInit = (cb: () => void) => {
  ls.run({ deps: new Map() }, cb);
};
