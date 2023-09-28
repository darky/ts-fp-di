import { AsyncLocalStorage } from 'async_hooks'
import assert from 'assert'
import test from 'node:test'
import { createSandbox } from 'sinon'

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
  clearGlobalState,
  diHas,
  diContext,
  diScope,
  dic,
} from './index.js'
import EventEmitter from 'events'

test('diDep error before init', async () => {
  const depFn = () => 1

  const fn = (dep = diDep(depFn)) => dep()

  await assert.rejects(async () => fn())
})

test('diSet error before init', async () => {
  const depFn = () => 1

  await assert.rejects(async () => diSet(depFn, () => 2))
})

test('dis error before init', async () => {
  const inc = dis((sum, n: number) => sum + n, 0)

  await assert.rejects(async () => inc())
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

test('dis global', () => {
  const inc = dis((sum, n: number) => sum + n, 0, true)

  inc(1)

  assert.equal(inc(1) + 1, 3)
})

test('dis map', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0)
    const s = inc.map(n => `string - ${n + 1}`)

    inc(1)

    assert.equal(inc(1) + 1, 3)
    assert.strictEqual(s().substring(0, 999), 'string - 3')
  })
})

test('clearGlobalState', () => {
  const inc = dis((sum, n: number) => sum + n, 0, true)

  inc(1)

  clearGlobalState()

  assert.equal(inc(), 0)
})

test('diOnce error before init', async () => {
  const fn = diOnce(() => 1)

  await assert.rejects(async () => fn())
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

test('diOnce map', () => {
  const fn = diOnce((n: number) => {
    return n
  })
  const s = fn.map(n => `string - ${n + 1}`)

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
    assert.equal(store?.deps.toString(), '[object Map]')
    assert.equal(store?.once.toString(), '[object Map]')
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
    deps: new Map([['foo', 'bar']]),
    state: new Map(),
    once: new Map(),
  }
  await diInit(async () => {
    assert.equal(diDep('foo'), 'bar')
  }, ctx)
})

test('diInit can receive context event if parent context exists', async () => {
  const ctx = {
    deps: new Map([['foo', 'bar']]),
    state: new Map(),
    once: new Map(),
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
    deps: new Map([['foo', 'bar']]),
    state: new Map(),
    once: new Map(),
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

test('diHas false', () => {
  diInit(() => {
    const fn = (dep = diHas('test')) => dep

    assert.equal(fn(), false)
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

test('diContext', () => {
  assert.deepEqual(diContext(), {
    deps: new Map(),
    once: new Map(),
    state: new Map(),
  })
})

test('diScope', () => {
  const inc = dis((resp: number, n: number) => resp + n, 0)
  const checkScope = di((scope: string) => diDep<boolean>(scope))

  const scope1 = diScope({ inc, checkScope }, () => diSet('scope1', true))
  const scope2 = diScope({ inc, checkScope }, () => diSet('scope2', true))

  assert.strictEqual(scope1.checkScope('scope1'), true)
  assert.rejects(async () => scope1.checkScope('scope2'), new Error('Dependency with key scope2 not registered!'))
  assert.strictEqual(scope2.checkScope('scope2'), true)
  assert.rejects(async () => scope2.checkScope('scope1'), new Error('Dependency with key scope1 not registered!'))

  scope1.inc(2)
  scope2.inc(5)

  assert.strictEqual(scope1.inc(), 2)
  assert.strictEqual(scope2.inc(), 5)
})

test('dic', () => {
  const n = dic<number>()
  diInit(() => {
    n(1)
    assert.strictEqual(n(), 1)
  })
})

test('dic map', () => {
  const n = dic<number>()
  const s = n.map(n => `string - ${n + 1}`)
  diInit(() => {
    n(1)
    assert.strictEqual(n(), 1)
    assert.strictEqual(s().substring(0, 999), 'string - 2')
  })
})

test('dic map recursive', () => {
  const n = dic<number>()
  const s = n.map(n => `string - ${n + 1}`)
  const l = s.map(s => s.length)
  diInit(() => {
    n(1)
    assert.strictEqual(l() + 1, 11)
  })
})

test('mapWith', () => {
  const n = dic<number>()
  const s = dic<string>()
  const comb = s.mapWith((s, n) => `${s} ${n}`, n)
  diInit(() => {
    n(1)
    s('test')
    assert.strictEqual(comb().substring(0, 999), 'test 1')
  })
})
