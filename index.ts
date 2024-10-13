import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Context which exists within {@link diInit} callback
 */
export type AlsContext = {
  /**
   * Contains overriden {@link di} functions here
   */
  readonly '@@deps': ReadonlyMap<unknown, unknown>
  /**
   * Contains cached returns of {@link diOnce}, {@link diMapOnce}, {@link dic} here
   */
  readonly '@@once': ReadonlyMap<unknown, unknown>
  /**
   * Contains states of {@link dis}, {@link div} here
   */
  readonly '@@state': ReadonlyMap<unknown, unknown>
  /**
   * Contains derived states of {@link diMap} here
   */
  readonly '@@derived': ReadonlyMap<unknown, unknown>
  /**
   * AlsContext can be extended by any property via third-party plugins
   */
  [k: string]: unknown
}

export const als = new AsyncLocalStorage<AlsContext>()

export class DiNotInitializedError extends Error {
  constructor() {
    super('DI container not initialized! Consider, that you call "diInit" before')
  }
}

export class DependencyNotRegisteredError extends Error {
  constructor(dep: string) {
    super(`Dependency with key "${dep}" not registered!`)
  }
}

/**
 * Make function **Dependency Injection** friendly
 *
 * Responded function should be called within {@link diInit} callback
 *
 * @example
 * const fun = di(x => x + 1)
 * fun(1) // 2
 * diSet(fun, x => x + 2)
 * fun(1) // 3
 *
 */
export const di = <T extends Function>(fn: T): T => {
  const overrideFn = function (this: unknown, ...args: unknown[]) {
    const store = storeOrError()
    const userDep = (store['@@deps'] as Map<T, T>).get(overrideFn)

    return (userDep ?? fn).apply(this, args)
  } as unknown as T
  return overrideFn
}

/**
 * Redux like state reducer within {@link diInit} callback
 *
 * Call it with value for state reducing
 *
 * Call it without arguments for getting state
 *
 * @example
 * const sum = dis((sum, n) => sum + n, 0)
 * sum(5)
 * sum(5)
 * sum() // 10
 */
export const dis = <P, S>(fn: (state: S, payload: P) => S, defaultState: S) => {
  const stateFn = function (this: unknown, payload?: P) {
    const store = storeOrError()
    const oldState = (store['@@state'] as Map<unknown, S>).get(stateFn)

    if (payload == null) {
      return oldState ?? defaultState
    }

    const newState = fn(oldState ?? defaultState, payload)
    ;(store['@@state'] as Map<unknown, unknown>).set(stateFn, newState)

    return newState
  }
  return stateFn
}

/**
 * Setter for caching value within {@link diInit} callback
 *
 * Call it with value for caching
 *
 * Call it without arguments for getting value from cache
 *
 * @example
 * const num = dic<number>()
 * num(5) // cache 5 inside `num` setter
 * num() // 5
 * num(10) // change cached value to 10
 * num() // 10
 */
export const div = <T>() => {
  const dio: (x?: T) => T = dis((_, x: T) => x as T, void 0 as T)
  return dio
}

/**
 * Extract value from **Dependency Injection** by unique string literal
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * type User = {
 *   login: string;
 *   roles: string[];
 * }
 * const user: User = {login: 'root', roles: ['admin']}
 * diSet('user', user)
 * diDep<User>('user') // {login: 'root', roles: ['admin']}
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 * @throws {@link DependencyNotRegisteredError} if dependency not registered
 */
export function diDep<T>(dep: string): T
/**
 * Extract overriden function from **Dependency Injection**
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * const fun = () => 1
 * diSet(fun, () => 2)
 * diDep(fun)() // 2
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 */
export function diDep<T extends Function>(dep: T): T
export function diDep(dep: unknown) {
  const store = storeOrError()
  const userDep = store['@@deps'].get(dep)

  if (typeof dep === 'string' && userDep == null) {
    throw new DependencyNotRegisteredError(dep)
  }

  return userDep ?? dep
}

/**
 * Override **Dependency Injection** friendly function with another one
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * const fun = di(x => x + 1)
 * fun(1) // 2
 * diSet(fun, x => x + 2)
 * fun(1) // 3
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 */
export function diSet<T extends Function>(dep: T, value: T): void
/**
 * Register any value inside **Dependency Injection** container by unique string literal
 *
 * Can be extracted later using {@link diDep}
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * type User = {
 *   login: string;
 *   roles: string[];
 * }
 * const user: User = {login: 'root', roles: ['admin']}
 * diSet('user', user)
 * diDep<User>('user') // {login: 'root', roles: ['admin']}
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 */
export function diSet(dep: string, value: unknown): void
export function diSet<T extends Function>(dep: T | string, value: T | unknown) {
  const store = storeOrError()
  ;(store['@@deps'] as Map<unknown, unknown>).set(dep, value)
}

/**
 * Check that **Dependency Injection** friendly function was overriden
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * const fun = di(x => x + 1)
 * diSet(fun, x => x + 2)
 * diHas(fun) // true
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 */
export function diHas<T extends Function>(dep: T): boolean
/**
 * Check that dependency was registered by string literal in **Dependency Injection** container
 *
 * Should be called within {@link diInit} callback
 *
 * @example
 * const user: User = {login: 'root', roles: ['admin']}
 * diSet('user', user)
 * diHas('user') // true
 *
 * @throws {@link DiNotInitializedError} if called outside of {@link diInit} callback
 */
export function diHas(dep: string): boolean
export function diHas(dep: unknown): boolean {
  const store = storeOrError()
  return store['@@deps'].has(dep)
}

/**
 * Entry point for almost all **ts-fp-di** API
 *
 * Should be called on each HTTP request, MQ message handling, cron job or just in test
 *
 * @example
 * diInit(() => {
 *   // ts-fp-di API usage here
 *   // or call `next` function of middleware here
 * })
 *
 */
export const diInit = <T>(
  cb: () => T,
  /**
   * @internal
   */
  ctx?: AlsContext
) => {
  return diExists()
    ? ctx
      ? als.run(
          {
            ...als.getStore(),
            '@@deps': new Map(
              Array.from(als.getStore()!['@@deps'].entries()).concat(Array.from(ctx['@@deps'].entries()))
            ),
            '@@once': new Map(
              Array.from(als.getStore()!['@@once'].entries()).concat(Array.from(ctx['@@once'].entries()))
            ),
            '@@state': new Map(
              Array.from(als.getStore()!['@@state'].entries()).concat(Array.from(ctx['@@state'].entries()))
            ),
            '@@derived': new Map(
              Array.from(als.getStore()!['@@derived'].entries()).concat(Array.from(ctx['@@derived'].entries()))
            ),
          },
          cb
        )
      : cb()
    : als.run(ctx ?? diContext(), cb)
}

/**
 * Make function, which calling result will be cached within {@link diInit} callback
 *
 * @example
 * const fun = diOnce(n => n + 1)
 * fun(1) // 2
 * fun(8) // again 2, because it's cached
 *
 */
export const diOnce = <T extends Function>(fn: T) => {
  const onceFn = function (this: unknown, ...args: unknown[]) {
    const store = storeOrError()
    return (
      store['@@once'].get(onceFn) ??
      (store['@@once'] as Map<unknown, unknown>).set(onceFn, fn.apply(this, args)).get(onceFn)
    )
  } as unknown as T

  return onceFn
}

/**
 *
 * Override cached result of {@link diOnce} call
 *
 * Should be cached within {@link diInit} callback
 *
 * @example
 * const fun = diOnce(n => n + 1)
 * fun(1) // 2
 * diOnceSet(fun, 9)
 * fun(8) // 9
 *
 */
export const diOnceSet = <T extends (...args: any[]) => any>(fn: T, value: ReturnType<T>) => {
  const store = storeOrError()
  ;(store['@@once'] as Map<unknown, unknown>).set(fn, value)
}

/**
 * Check runtime within {@link diInit} callback
 *
 * @example
 * diExists() // false
 * diInit(() => diExists()) // true
 */
export const diExists = () => (als.getStore() == null) === false

/**
 * Incapsulate state managment inside particular scope
 *
 * @example
 * const sum = dis((sum, n) => sum + n, 0)
 * const scope1 = diScope({sum})
 * const scope2 = diScope({sum})
 *
 * scope1.sum(1)
 * scope1.sum(4)
 * scope1.sum() // 5
 *
 * scope2.sum(3)
 * scope2.sum(7)
 * scope2.sum() // 10
 */
export const diScope = <T extends { [key: string]: Function }>(scope: T, init?: () => void): T => {
  const ctx = diContext()
  if (init) {
    diInit(init, ctx)
  }
  return Object.fromEntries(
    Object.entries(scope).map(([key, fn]) => [
      key,
      function (this: unknown, ...args: unknown[]) {
        return diInit(() => fn.apply(this, args), ctx)
      } as Function,
    ])
  ) as T
}

/**
 * Setter for caching constant value within {@link diInit} callback
 *
 * Call it with constant value for caching
 *
 * Call it without arguments for getting constant value from cache
 *
 * @example
 * const num = dic<number>()
 * num(5) // cache 5 inside `num` setter
 * num() // 5
 * num(10) // no affect, because 5 already cached
 * num() // 5
 */
export const dic = <T>() => {
  const dio: (x?: T | undefined) => T = diOnce((x?: T) => x as T)
  return dio
}

export function diMap<T1, R>(pred: (x1: T1) => R, fn1: (...args: any[]) => T1): (() => R) & { raw: (x1: T1) => R }
export function diMap<T1, T2, R>(
  pred: (x1: T1, x2: T2) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2
): (() => R) & { raw: (x1: T1, x2: T2) => R }
export function diMap<T1, T2, T3, R>(
  pred: (x1: T1, x2: T2, x3: T3) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3) => R }
export function diMap<T1, T2, T3, T4, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4) => R }
export function diMap<T1, T2, T3, T4, T5, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5) => R }
export function diMap<T1, T2, T3, T4, T5, T6, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5,
  fn6: (...args: any[]) => T6
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6) => R }
export function diMap<T1, T2, T3, T4, T5, T6, T7, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5,
  fn6: (...args: any[]) => T6,
  fn7: (...args: any[]) => T7
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7) => R }
export function diMap<T1, T2, T3, T4, T5, T6, T7, T8, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5,
  fn6: (...args: any[]) => T6,
  fn7: (...args: any[]) => T7,
  fn8: (...args: any[]) => T8
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8) => R }
export function diMap<T1, T2, T3, T4, T5, T6, T7, T8, T9, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5,
  fn6: (...args: any[]) => T6,
  fn7: (...args: any[]) => T7,
  fn8: (...args: any[]) => T8,
  fn9: (...args: any[]) => T9
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9) => R }
export function diMap<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, R>(
  pred: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9, x10: T10) => R,
  fn1: (...args: any[]) => T1,
  fn2: (...args: any[]) => T2,
  fn3: (...args: any[]) => T3,
  fn4: (...args: any[]) => T4,
  fn5: (...args: any[]) => T5,
  fn6: (...args: any[]) => T6,
  fn7: (...args: any[]) => T7,
  fn8: (...args: any[]) => T8,
  fn9: (...args: any[]) => T9,
  fn10: (...args: any[]) => T10
): (() => R) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9, x10: T10) => R }
/**
 * Combine multiple states to one within {@link diInit} callback
 *
 * @example
 * const nums = dis((ns, n) => [...ns, n], [])
 * const prefix = dic<string>()
 * const numbers = diMap((prefix, nums) => `${prefix} ${nums}`, prefix, nums)
 * prefix('Numbers: ')
 * nums(1)
 * nums(2)
 * nums(3)
 * numbers() // Numbers: 1,2,3
 * nums(4)
 * numbers() // Numbers: 1,2,3,4
 */
export function diMap(pred: (...args: unknown[]) => unknown, ...fns: (() => unknown)[]) {
  const diMapFn = () => {
    const r = pred(...fns.map(f => f()))
    ;(storeOrError()['@@derived'] as Map<unknown, unknown>).set(diMapFn, r)
    return r
  }
  return Object.assign(diMapFn, { raw: pred })
}

/**
 * Combine multiple states to one with further caching within {@link diInit} callback
 *
 * @example
 * const nums = dis((ns, n) => [...ns, n], [])
 * const prefix = dic<string>()
 * const numbers = diMapOnce((prefix, nums) => `${prefix} ${nums}`, prefix, nums)
 * prefix('Numbers: ')
 * nums(1)
 * nums(2)
 * nums(3)
 * numbers() // Numbers: 1,2,3
 * nums(4)
 * numbers() // Numbers: 1,2,3 - because cached
 */
export const diMapOnce: typeof diMap = (raw: (...args: unknown[]) => unknown, ...fns: (() => unknown)[]) =>
  Object.assign(diOnce(diMap(raw, ...(fns as [() => unknown]))), { raw })

export function dise<R>(
  effect: () => Promise<R>,
  dicOutput: (x: R) => R
): (() => Promise<R>) & { raw: () => Promise<R> }
export function dise<R, T1>(
  effect: (x1: T1) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1
): (() => Promise<R>) & { raw: (x1: T1) => Promise<R> }
export function dise<R, I, T1, T2>(
  effect: (x1: T1, x2: T2) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2
): (() => Promise<R>) & { raw: (x1: T1, x2: T2) => Promise<R> }
export function dise<R, T1, T2, T3>(
  effect: (x1: T1, x2: T2, x3: T3) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3) => Promise<R> }
export function dise<R, T1, T2, T3, T4>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5, T6>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5,
  dicInput6: () => T6
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5, T6, T7>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5,
  dicInput6: () => T6,
  dicInput7: () => T7
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5, T6, T7, T8>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5,
  dicInput6: () => T6,
  dicInput7: () => T7,
  dicInput8: () => T8
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5,
  dicInput6: () => T6,
  dicInput7: () => T7,
  dicInput8: () => T8,
  dicInput9: () => T9
): (() => Promise<R>) & { raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9) => Promise<R> }
export function dise<R, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
  effect: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9, x10: T10) => Promise<R>,
  dicOutput: (x: R) => R,
  dicInput1: () => T1,
  dicInput2: () => T2,
  dicInput3: () => T3,
  dicInput4: () => T4,
  dicInput5: () => T5,
  dicInput6: () => T6,
  dicInput7: () => T7,
  dicInput8: () => T8,
  dicInput9: () => T9,
  dicInput10: () => T10
): (() => Promise<R>) & {
  raw: (x1: T1, x2: T2, x3: T3, x4: T4, x5: T5, x6: T6, x7: T7, x8: T8, x9: T9, x10: T10) => Promise<R>
}
/**
 * Attach side effect function to state within {@link diInit} callback
 *
 * Effect can be Promise returned function
 *
 * Value of resolved Promise will be passed to state function
 *
 * Also variadic amount of state functions can passed as inputs Effect
 *
 * @example
 * const userId = dic<number>()
 * const user = dic<{age: number; id: number; name: string;}>()
 * const fetchUser = dise(
 *   id => db.query('select * from users where id = $1', [id]),
 *   user,
 *   userId)
 *
 * userId(1)
 * await fetchUser()
 * user() // {age: 50, id: 1, name: 'Bob'}
 */
export function dise(
  effect: (...args: unknown[]) => Promise<unknown>,
  dicOutput: (x: unknown) => unknown,
  ...dicInputs: (() => unknown)[]
) {
  const raw = di(effect)
  return Object.assign(() => raw(...dicInputs.map(dic => dic())).then(r => dicOutput(r)), { raw })
}

/**
 * Override side effect {@link dise} function within {@link diInit} callback
 *
 * @example
 * const userId = dic<number>()
 * const user = dic<{age: number; id: number; name: string;}>()
 * const fetchUser = dise(
 *   id => db.query('select * from users where id = $1', [id]),
 *   user,
 *   userId)
 * diseSet(fetchUser, id => id === 1 ? {age: 30, id: 1, name: 'Alice'} : null)
 *
 * userId(1)
 * await fetchUser()
 * user() // {age: 30, id: 1, name: 'Alice'}
 */
export const diseSet = <T extends Function>(fun: { raw: T }, replacement: T) => diSet(fun.raw, replacement)

const storeOrError = () => {
  const store = als.getStore()

  if (store == null) {
    throw new DiNotInitializedError()
  }

  return store
}

const diContext = (): AlsContext => ({
  '@@deps': new Map(),
  '@@once': new Map(),
  '@@state': new Map(),
  '@@derived': new Map(),
})
