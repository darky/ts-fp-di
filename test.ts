import { AsyncLocalStorage } from 'async_hooks';
import assert from 'assert';
import test from 'node:test';
import { createSandbox } from 'sinon';

import { diInit, diDep, diSet, diOnce, diExists, diOnceSet, als, di, dis, clearGlobalState, diHas, diRawStore } from './index.js';
import EventEmitter from 'events';

test('diDep error before init', async () => {
  const depFn = () => 1;

  const fn = (dep = diDep(depFn)) => dep();

  await assert.rejects(async () => fn());
});

test('diSet error before init', async () => {
  const depFn = () => 1;

  await assert.rejects(async () => diSet(depFn, () => 2));
});

test('dis error before init', async () => {
  const inc = dis((sum, n: number) => sum + n, 0);

  await assert.rejects(async () => inc());
});

test('di with default fn', () => {
  diInit(() => {
    const depFn = di(() => 1);

    assert.equal(depFn(), 1);
  });
});

test('di with override fn', () => {
  diInit(() => {
    const depFn = di(() => 1 as number);

    diSet(depFn, () => 2);

    assert.equal(depFn(), 2);
  });
});

test('diDep with default fn', () => {
  diInit(() => {
    const depFn = () => 1;

    assert.equal(diDep(depFn)(), 1);
  });
});

test('diDep with override fn', () => {
  diInit(() => {
    const depFn = () => 1;

    diSet(depFn, () => 2);

    assert.equal(diDep(depFn)(), 2);
  });
});

test('diDep with string dep', () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep;

    diSet('test', 'test');

    assert.equal(fn(), 'test');
  });
});

test('diDep error when not exists string dep', async () => {
  await diInit(async () => {
    const fn = (dep = diDep('test')) => dep;

    await assert.rejects(async () => fn());
  });
});

test('diDep with string dep type generic support', () => {
  diInit(() => {
    const fn = (dep = diDep<boolean>('test')) => dep;

    diSet('test', true);

    assert.equal(fn(), true);
  });
});

test('dis default', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0);

    assert.equal(inc(), 0);
  });
});

test('dis simple', () => {
  diInit(() => {
    const inc = dis((sum, n: number) => sum + n, 0);

    inc(1);

    assert.equal(inc(1) + 1, 3);
  });
});

test('dis global', () => {
  const inc = dis((sum, n: number) => sum + n, 0, true);

  inc(1);

  assert.equal(inc(1) + 1, 3);
});

test('clearGlobalState', () => {
  const inc = dis((sum, n: number) => sum + n, 0, true);

  inc(1);

  clearGlobalState();

  assert.equal(inc(), 0);
});

test('diOnce error before init', async () => {
  const fn = diOnce(() => 1);

  await assert.rejects(async () => fn());
});

test('diOnce', () => {
  let i = 0;
  const fn = diOnce((n: number) => {
    i += n;
    return i;
  });

  diInit(() => {
    assert.equal(fn(1), 1);
    assert.equal(fn(1), 1);
    assert.equal(i, 1);
  });
});

test('diOnceSet', () => {
  const fn = diOnce((n: number) => {
    return n + 1;
  });

  diInit(() => {
    diOnceSet(fn, 2);
    assert.equal(fn(4), 2);
  });
});

test('expose als', () => {
  diInit(() => {
    const store = als.getStore();
    assert.equal(store?.deps.toString(), '[object Map]');
    assert.equal(store?.once.toString(), '[object Map]');
  });
});

test('diInit flatten', () => {
  let i = 0;

  const sinon = createSandbox();
  sinon.spy(als);

  diInit(() => {
    diInit(() => {
      i++;
    });
  });

  assert.equal(i, 1);
  assert.equal((als.run as any).calledOnce, true);

  sinon.restore();
});

test('diInit on existing als', async () => {
  await new AsyncLocalStorage().run({}, async () => {
    await diInit(async () => {
      diSet('foo', 'bar');
      assert.equal(diDep('foo'), 'bar')
    })
  })
});

test('diInit can receive context', async () => {
  const ctx = {
    deps: new Map([['foo', 'bar']]),
    state: new Map(),
    once: new Map()
  }
  await diInit(async () => {
    assert.equal(diDep('foo'), 'bar')
  }, ctx)
});

test('diExists - false', () => {
  assert.equal(diExists(), false);
});

test('diExists - true', () => {
  diInit(() => {
    assert.equal(diExists(), true);
  });
});

test('diHas true', () => {
  diInit(() => {
    const fn = (dep = diHas('test')) => dep;

    diSet('test', true);

    assert.equal(fn(), true);
  });
});

test('diHas false', () => {
  diInit(() => {
    const fn = (dep = diHas('test')) => dep;

    assert.equal(fn(), false);
  });
});

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

test('diRawStore simple', () => {
  diInit(() => {
    diSet('test', true)
    assert.deepEqual(diRawStore(), {
      deps: new Map([['test', true]]),
      once: new Map(),
      state: new Map()
    })
  })
})
