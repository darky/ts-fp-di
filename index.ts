import { AsyncLocalStorage } from 'async_hooks'

type AlsContext = {
  deps: Map<unknown, unknown>
  once: Map<unknown, unknown>
  state: Map<unknown, unknown>
  derived: Map<unknown, unknown>
  [k: string]: unknown
}

export const als = new AsyncLocalStorage<AlsContext>()

const globalState = new Map<unknown, unknown>()

export const clearGlobalState = () => globalState.clear()

export const di = <T extends Function>(fn: T): T => {
  const overrideFn = function (this: unknown, ...args: unknown[]) {
    const store = storeOrError()
    const userDep = (store.deps as Map<T, T>).get(overrideFn)

    return (userDep ?? fn).apply(this, args)
  } as unknown as T
  return overrideFn
}

export const dis = <P, S>(fn: (state: S, payload: P) => S, defaultState: S, isGlobal = false) => {
  const stateFn = function (this: unknown, payload?: P) {
    let store: ReturnType<typeof als.getStore>
    const stateMap = isGlobal ? globalState : ((store = storeOrError()), store.state as Map<unknown, S>)

    const oldState = (stateMap as Map<unknown, S>).get(stateFn)

    if (payload == null) {
      return oldState ?? defaultState
    }

    const newState = fn(oldState ?? defaultState, payload)
    stateMap.set(stateFn, newState)

    return newState
  }
  return stateFn
}

export const diDep = <T>(dep: T | string): T => {
  const store = storeOrError()
  const userDep = (store.deps as Map<T | string, T>).get(dep)

  if (typeof dep === 'string' && userDep == null) {
    throw new Error(`Dependency with key ${dep} not registered!`)
  }

  return userDep ?? (dep as T)
}

export const diSet = <T>(dep: T, value: T extends string ? unknown : T) => {
  const store = storeOrError()
  store.deps.set(dep, value)
}

export const diHas = <T>(dep: T | string): boolean => {
  const store = storeOrError()
  return (store.deps as Map<T | string, T>).has(dep)
}

export const diInit = <T>(cb: () => T, ctx?: AlsContext) => {
  return diExists()
    ? ctx
      ? als.run(
          {
            ...als.getStore(),
            deps: new Map(Array.from(als.getStore()!.deps.entries()).concat(Array.from(ctx.deps.entries()))),
            once: new Map(Array.from(als.getStore()!.once.entries()).concat(Array.from(ctx.once.entries()))),
            state: new Map(Array.from(als.getStore()!.state.entries()).concat(Array.from(ctx.state.entries()))),
            derived: new Map(Array.from(als.getStore()!.derived.entries()).concat(Array.from(ctx.derived.entries()))),
          },
          cb
        )
      : cb()
    : als.run(ctx ?? diContext(), cb)
}

export const diOnce = <T extends (...args: any) => any>(fn: T) => {
  const onceFn = function (this: unknown, ...args: Parameters<T>) {
    const store = storeOrError()
    return store.once.get(onceFn) ?? store.once.set(onceFn, fn.apply(this, args)).get(onceFn)
  } as unknown as T

  return onceFn
}

export const diOnceSet = <T>(fn: (...args: any[]) => T, value: T) => {
  const store = storeOrError()
  store.once.set(fn, value)
}

export const diExists = () => (als.getStore() == null) === false

export const diContext = (): AlsContext => ({ deps: new Map(), once: new Map(), state: new Map(), derived: new Map() })

export const diScope = <T extends { [key: string]: any }>(scope: T, init?: () => void): T => {
  const ctx = diContext()
  if (init) {
    diInit(init, ctx)
  }
  return Object.fromEntries(
    Object.entries(scope).map(([key, fn]) => [
      key,
      function (this: unknown, ...args: unknown[]) {
        return diInit(() => fn.apply(this, args), ctx)
      },
    ])
  ) as T
}

export const dic = <T>() => {
  const dio: (x?: T | undefined) => T = diOnce((x?: T) => x as T)
  return dio
}

export function diMap<T1, R>(pred: (x1: T1) => R, fn1: (...args: any[]) => T1): () => R
export function diMap<T1, T2, R>(
  pred: (x1: T1, x2: T2) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2
): () => R
export function diMap<T1, T2, T3, R>(
  pred: (x1: T1, x2: T2, x3: T3) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3
): () => R
export function diMap(pred: (...args: unknown[]) => unknown, ...fns: (() => unknown)[]) {
  return () => pred(...fns.map(f => f()))
}

const storeOrError = () => {
  const store = als.getStore()

  if (store == null) {
    throw new Error('DI container not registered! Consider, that you call "diInit" before')
  }

  return store
}
