import { AsyncLocalStorage } from 'async_hooks';

export const als = new AsyncLocalStorage<{
  deps: Map<unknown, unknown>;
  once: Map<unknown, unknown>;
  state: Map<unknown, unknown>;
  [k: string]: unknown;
}>();

export const di = <T extends Function>(fn: T): T => {
  const overrideFn = function (this: unknown, ...args: unknown[]) {
    const store = storeOrError();
    const userDep = (store.deps as Map<T, T>).get(overrideFn);

    return (userDep ?? fn).apply(this, args);
  } as unknown as T;
  return overrideFn;
};

export const dis = <P, S>(fn: (state: S, payload: P) => S, defaultState: S): ((payload?: P) => S) => {
  const stateFn = function (this: unknown, payload?: P) {
    const store = storeOrError();
    const oldState = (store.state as Map<unknown, S>).get(stateFn);

    if (payload == null) {
      return oldState ?? defaultState;
    }

    const newState = fn(oldState ?? defaultState, payload);
    store.state.set(stateFn, newState);

    return newState;
  };
  return stateFn;
};

export const diDep = <T>(dep: T | string): T => {
  const store = storeOrError();
  const userDep = (store.deps as Map<T | string, T>).get(dep);

  if (typeof dep === 'string' && userDep == null) {
    throw new Error(`Dependency with key ${dep} not registered!`);
  }

  return userDep ?? (dep as T);
};

export const diSet = <T>(dep: T, value: T extends string ? unknown : T) => {
  const store = storeOrError();
  store.deps.set(dep, value);
};

export const diInit = <T>(cb: () => T) => {
  return diExists() ? cb() : als.run({ deps: new Map(), once: new Map(), state: new Map() }, cb);
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
  const store = als.getStore();

  if (store == null) {
    throw new Error('DI container not registered! Consider, that you call "diInit" before');
  }

  return store;
};

export const diExists = () => (als.getStore() == null) === false;
