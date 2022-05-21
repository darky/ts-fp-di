import assert from 'assert';
import { createSandbox } from 'sinon';

// TODO rewrite to ESM when @types/node >= 18
const test: Function = require('node:test');

import { diInit, diDep, diSet, diOnce, diExists, diOnceSet, als, di, dis } from './index.js';

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
  const inc = dis((n: number, sum) => sum + n, 0);

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
    const inc = dis((n: number, sum) => sum + n, 0);

    assert.equal(inc(), 0);
  });
});

test('dis simple', () => {
  diInit(() => {
    const inc = dis((n: number, sum) => sum + n, 0);

    inc(1);

    assert.equal(inc(1) + 1, 3);
  });
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

test('diExists - false', () => {
  assert.equal(diExists(), false);
});

test('diExists - true', () => {
  diInit(() => {
    assert.equal(diExists(), true);
  });
});
