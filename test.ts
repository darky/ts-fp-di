import { AsyncLocalStorage } from 'node:async_hooks'
import assert from 'node:assert'
import test from 'node:test'
import { createSandbox } from 'sinon'
import { setTimeout as setTimeoutP } from 'node:timers/promises'

import {
  diInit,
  diDep,
  diSet,
  diOnce,
  diExists,
  diOnceSet,
  als,
  di,
  dis,
  diHas,
  diScope,
  dic,
  diMap,
  dise,
  diMapOnce,
  div,
  diseSet,
  DiNotInitializedError,
  DependencyNotRegisteredError,
} from './index.js'
import EventEmitter from 'node:events'
import { setImmediate } from 'node:timers'
import process from 'node:process'

test('diDep error before init', async () => {
  const depFn = () => 1

  const fn = (dep = diDep(depFn)) => dep()

  await assert.rejects(async () => fn(), DiNotInitializedError)
})

test('diSet error before init', async () => {
  const depFn = () => 1

  await assert.rejects(async () => diSet(depFn, () => 2), DiNotInitializedError)
})

test('dis error before init', async () => {
  const inc = dis((sum, n: number) => sum + n, 0)

  await assert.rejects(async () => inc(), DiNotInitializedError)
})

test('di with default fn', () => {
  diInit(() => {
    const depFn = di(() => 1)

    assert.equal(depFn(), 1)
  })
})

test('di with override fn', () => {
  diInit(() => {
    const depFn = di(() => 1 as number)

    diSet(depFn, () => 2)

    assert.equal(depFn(), 2)
  })
})

test('diDep with default fn', () => {
  diInit(() => {
    const depFn = () => 1

    assert.equal(diDep(depFn)(), 1)
  })
})

test('diDep with override fn', () => {
  diInit(() => {
    const depFn = () => 1

    diSet(depFn, () => 2)

    assert.equal(diDep(depFn)(), 2)
  })
})

test('diDep with string dep', () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep

    diSet('test', 'test')

    assert.equal(fn(), 'test')
  })
})

test('diDep error when not exists string dep', async () => {
  await diInit(async () => {
    const fn = (dep = diDep('test')) => dep

    await assert.rejects(async () => fn())
  })
})

test('diDep with string dep type generic support', () => {
  diInit(() => {
    const fn = (dep = diDep<boolean>('test')) => dep

    diSet('test', true)

    assert.equal(fn(), true)
  })
})

test('dis default', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0)

    assert.equal(inc(), 0)
  })
})

test('dis simple', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0)

    inc(1)

    assert.equal(inc(1) + 1, 3)
  })
})

test('dis diMap', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0)
    const s = diMap(n => `string - ${n + 1}`, inc)

    inc(1)

    assert.equal(inc(1) + 1, 3)
    assert.strictEqual(s().substring(0, 999), 'string - 3')
  })
})

test('diOnce error before init', async () => {
  const fn = diOnce(() => 1)

  await assert.rejects(async () => fn(), DiNotInitializedError)
})

test('diOnce', () => {
  let i = 0
  const fn = diOnce((n: number) => {
    i += n
    return i
  })

  diInit(() => {
    assert.equal(fn(1), 1)
    assert.equal(fn(1), 1)
    assert.equal(i, 1)
  })
})

test('diOnce diMap', () => {
  const fn = diOnce((n: number) => {
    return n
  })
  const s = diMap(n => `string - ${n + 1}`, fn)

  diInit(() => {
    assert.equal(fn(1), 1)
    assert.equal(s().substring(0, 999), 'string - 2')
  })
})

test('diOnceSet', () => {
  const fn = diOnce((n: number) => {
    return n + 1
  })

  diInit(() => {
    diOnceSet(fn, 2)
    assert.equal(fn(4), 2)
  })
})

test('expose als', () => {
  diInit(() => {
    const store = als.getStore()
    assert.equal(store?.['@@deps'].toString(), '[object Map]')
    assert.equal(store?.['@@once'].toString(), '[object Map]')
  })
})

test('diInit flatten', () => {
  let i = 0

  const sinon = createSandbox()
  sinon.spy(als)

  diInit(() => {
    diInit(() => {
      i++
    })
  })

  assert.equal(i, 1)
  assert.equal((als.run as any).calledOnce, true)

  sinon.restore()
})

test('diInit on existing als', async () => {
  await new AsyncLocalStorage().run({}, async () => {
    await diInit(async () => {
      diSet('foo', 'bar')
      assert.equal(diDep('foo'), 'bar')
    })
  })
})

test('diInit can receive context', async () => {
  const ctx = {
    '@@deps': new Map([['foo', 'bar']]),
    '@@state': new Map(),
    '@@once': new Map(),
    '@@derived': new Map(),
  }
  await diInit(async () => {
    assert.equal(diDep('foo'), 'bar')
  }, ctx)
})

test('diInit can receive context event if parent context exists', async () => {
  const ctx = {
    '@@deps': new Map([['foo', 'bar']]),
    '@@state': new Map(),
    '@@once': new Map(),
    '@@derived': new Map(),
  }
  await diInit(async () => {
    diSet('test', true)
    await diInit(async () => {
      assert.equal(diDep('foo'), 'bar')
    }, ctx)
  })
})

test("if diInit receive context, don't miss parent context", async () => {
  const ctx = {
    '@@deps': new Map([['foo', 'bar']]),
    '@@state': new Map(),
    '@@once': new Map(),
    '@@derived': new Map(),
  }
  await diInit(async () => {
    diSet('test', true)
    await diInit(async () => {
      assert.equal(diDep('test'), true)
    }, ctx)
  })
})

test('diExists - false', () => {
  assert.equal(diExists(), false)
})

test('diExists - true', () => {
  diInit(() => {
    assert.equal(diExists(), true)
  })
})

test('diHas true', () => {
  diInit(() => {
    const fn = (dep = diHas('test')) => dep

    diSet('test', true)

    assert.equal(fn(), true)
  })
})

test('diHas true for fn dep', () => {
  diInit(() => {
    const fn = di(() => 1 as number)

    diSet(fn, () => 2)

    assert.equal(diHas(fn), true)
  })
})

test('diHas false', () => {
  diInit(() => {
    const fn = (dep = diHas('test')) => dep

    assert.equal(fn(), false)
  })
})

test('diHas false for fn dep', () => {
  diInit(() => {
    const fn = di(() => 1 as number)

    assert.equal(diHas(fn), false)
  })
})

test('ensured di works inside setTimeout', async () => {
  await diInit(async () => {
    diSet('test', true)
    return new Promise(resolve => {
      setTimeout(() => {
        assert.strictEqual(diDep('test'), true)
        resolve(void 0)
      }, 1)
    })
  })
})

test('ensured di works inside setInterval', async () => {
  await diInit(async () => {
    diSet('test', true)
    return new Promise(resolve => {
      const timer = setInterval(() => {
        assert.strictEqual(diDep('test'), true)
        clearInterval(timer)
        resolve(void 0)
      }, 1)
    })
  })
})

test('ensured di works inside setImmediate', async () => {
  await diInit(async () => {
    diSet('test', true)
    return new Promise(resolve => {
      setImmediate(() => {
        assert.strictEqual(diDep('test'), true)
        resolve(void 0)
      })
    })
  })
})

test('ensured di works inside event emitter', async () => {
  await diInit(async () => {
    diSet('test', true)
    return new Promise(resolve => {
      const emitter = new EventEmitter()
      const listener = () => {
        assert.strictEqual(diDep('test'), true)
        emitter.off('event', listener)
        resolve(void 0)
      }
      emitter.on('event', listener)
      emitter.emit('event')
    })
  })
})

test('ensured di works inside process.nextTick', async () => {
  await diInit(async () => {
    diSet('test', true)
    return new Promise(resolve => {
      process.nextTick(() => {
        assert.strictEqual(diDep('test'), true)
        resolve(void 0)
      })
    })
  })
})

test('diScope', () => {
  const inc = dis((resp: number, n: number) => resp + n, 0)
  const checkScope = di((scope: string) => diDep<boolean>(scope))

  const scope1 = diScope({ inc, checkScope }, () => diSet('scope1', true))
  const scope2 = diScope({ inc, checkScope }, () => diSet('scope2', true))

  assert.strictEqual(scope1.checkScope('scope1'), true)
  assert.rejects(async () => scope1.checkScope('scope2'), new Error('Dependency with key "scope2" not registered!'))
  assert.strictEqual(scope2.checkScope('scope2'), true)
  assert.rejects(async () => scope2.checkScope('scope1'), new Error('Dependency with key "scope1" not registered!'))

  scope1.inc(2)
  scope2.inc(5)

  assert.strictEqual(scope1.inc(), 2)
  assert.strictEqual(scope2.inc(), 5)
})

test('diScope with setInterval', async () => {
  const inc = dis((resp: number, n: number) => resp + n, 0)
  const interval = dic<any>()
  const resetInterval = () => {
    clearInterval(interval())
  }

  const scope = diScope({ inc, resetInterval }, () => {
    interval(setInterval(() => inc(1), 10))
  })

  await setTimeoutP(40)
  scope.resetInterval()

  assert.strictEqual(scope.inc() > 2, true)
})

test('diScope with diInit', async () => {
  const num = dic<number>()
  const fetchNum = dise(async () => 5, num)
  const scope = diScope({ num, fetchNum })

  await scope.fetchNum()

  diInit(() => {
    assert.strictEqual(scope.num(), 5)
  })
})

test('diScope with diSet', async () => {
  const number = di(() => 1 as number)
  const changeNumberImpl = () => diSet(number, () => 2)
  const scope = diScope({ changeNumberImpl, number })

  scope.changeNumberImpl()
  assert.strictEqual(scope.number(), 2)
})

test('diScope methods works without bind', async () => {
  const num = dic<number>()
  const scope = diScope({ num })

  ;(fn => fn(3))(scope.num)

  assert.strictEqual(scope.num(), 3)
})

test('dic', () => {
  const n = dic<number>()
  diInit(() => {
    n(1)
    assert.strictEqual(n(), 1)
  })
})

test('dic not cached until set', () => {
  const n = dic<number>()
  const s = diMap(n => (n ? `string - ${n + 1}` : 'empty'), n)
  diInit(() => {
    assert.strictEqual(s(), 'empty')
    n(1)
    assert.strictEqual(s(), 'string - 2')
  })
})

test('dic diMap', () => {
  const n = dic<number>()
  const s = diMap(n => `string - ${n + 1}`, n)
  diInit(() => {
    n(1)
    assert.strictEqual(n(), 1)
    assert.strictEqual(s().substring(0, 999), 'string - 2')
  })
})

test('diMap n times', () => {
  const n = dic<number>()
  const s = diMap(n => `string - ${n + 1}`, n)
  const l = diMap(s => s.length, s)
  diInit(() => {
    n(1)
    assert.strictEqual(l() + 1, 11)
  })
})

test('diMap multiple args', () => {
  const n = dic<number>()
  const s = dic<string>()
  const comb = diMap((s, n) => `${s.substring(0, 999)} ${n - 1 + 1}`, s, n)
  diInit(() => {
    n(1)
    s('test')
    assert.strictEqual(comb().substring(0, 999), 'test 1')
  })
})

test('diMap should mutate derived', () => {
  const n = dic<number>()
  const s = diMap(n => `string - ${n + 1}`, n)
  diInit(() => {
    n(1)
    s()
    assert.deepStrictEqual(Array.from(als.getStore()?.['@@derived'].values() ?? []), ['string - 2'])
  })
})

test('diMap raw', () => {
  const n = dic<number>()
  const s = diMap(n => `string - ${n + 1}`, n)
  assert.strictEqual(s.raw(1), 'string - 2')
})

test('diMapOnce only once', () => {
  let i = 0
  const n = dic<number>()
  const s = diMapOnce(n => ((i = i + 1), `string - ${n + 1}`), n)
  diInit(() => {
    n(1)
    s()
    s()
    assert.strictEqual(i, 1)
  })
})

test('diMapOnce response', () => {
  const n = dic<number>()
  const s = diMapOnce(n => `string - ${n + 1}`, n)
  diInit(() => {
    n(1)
    assert.strictEqual(s(), 'string - 2')
  })
})

test('diMapOnce raw', () => {
  const n = dic<number>()
  const s = diMapOnce(n => `string - ${n + 1}`, n)
  diInit(() => {
    assert.strictEqual(s.raw(1), 'string - 2')
  })
})

test('diMapOnce not cached until returns non nullable', () => {
  const n = dic<number>()
  const s = diMapOnce(n => (n ? `string - ${n + 1}` : null), n)
  diInit(() => {
    assert.strictEqual(s(), null)
    n(1)
    assert.strictEqual(s(), 'string - 2')
  })
})

test('dise', async () => {
  await diInit(async () => {
    const n = dic<number>()
    n(1)
    const s = diMap(n => `string - ${n + 1}`, n)
    const output = dic<string>()
    const se = dise(async (n, s) => `${n} ${s}`, output, n, s)
    const resp = await se()
    assert.strictEqual(resp, '1 string - 2')
  })
})

test('dise output as input', async () => {
  await diInit(async () => {
    const n = dic<number>()
    n(1)
    const output = div<number | null>()
    const se = dise(async (n, out) => (out ? out + 1 : n + 1), output, n, output)
    assert.strictEqual(await se(), 2)
    assert.strictEqual(await se(), 3)
    assert.strictEqual(await se(), 4)
  })
})

test('diseSet', async () => {
  await diInit(async () => {
    const n = dic<number>()
    n(1)
    const s = diMap(n => `string - ${n + 1}`, n)
    const output = dic<string>()
    const se = dise(async (n, s) => `${n} ${s}`, output, n, s)
    diseSet(se, async (n, s) => `${s}; ${n} - mocked`)
    const resp = await se()
    assert.strictEqual(resp, 'string - 2; 1 - mocked')
  })
})

test('div', () => {
  const n = div<number>()
  diInit(() => {
    assert.strictEqual(n(), void 0)
    assert.strictEqual(n(5), 5)
    assert.strictEqual(n(), 5)
    assert.strictEqual(n(10), 10)
    assert.strictEqual(n(), 10)
  })
})

test('als disable throws diInit not registered', () => {
  const obj = { test: true }
  diInit(() => {
    diSet('obj', obj)
    als.disable()
    assert.throws(() => diDep('obj'), DiNotInitializedError)
  })
})

test('als disable inside setImmediate also throws diInit not registered', async () => {
  const obj = { test: true }
  diInit(async () => {
    diSet('obj', obj)
    setImmediate(() => als.disable())
    await setTimeoutP(10)
    assert.throws(() => diDep('obj'), DiNotInitializedError)
  })
})

test('reinit inside als exit', () => {
  diInit(() => {
    diSet('outer', true)
    assert.strictEqual(diExists(), true)
    assert.strictEqual(diDep('outer'), true)
    als.exit(() => {
      assert.strictEqual(diExists(), false)
      diInit(() => {
        diSet('inner', true)
        assert.strictEqual(diExists(), true)
        assert.strictEqual(diDep('inner'), true)
        assert.throws(() => diDep('outer'), DependencyNotRegisteredError)
      })
    })
  })
})
