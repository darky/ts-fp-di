import { test } from 'uvu';
import { equal, throws } from 'uvu/assert';
import { createSandbox } from 'sinon';

import { diInit, diDep, diSet, diOnce, diExists, diOnceSet, als, di } from './index.js';

test('diDep error before init', () => {
  const depFn = () => 1;

  const fn = (dep = diDep(depFn)) => dep();

  throws(() => fn());
});

test('diSet error before init', () => {
  const depFn = () => 1;

  throws(() => diSet(depFn, () => 2));
});

test('di with default fn', () => {
  diInit(() => {
    const depFn = di(() => 1);

    equal(depFn(), 1);
  });
});

test('di with override fn', () => {
  diInit(() => {
    const depFn = di(() => 1 as number);

    diSet(depFn, () => 2);

    equal(depFn(), 2);
  });
});

test('diDep with default fn', () => {
  diInit(() => {
    const depFn = () => 1;

    equal(diDep(depFn)(), 1);
  });
});

test('diDep with override fn', () => {
  diInit(() => {
    const depFn = () => 1;

    diSet(depFn, () => 2);

    equal(diDep(depFn)(), 2);
  });
});

test('diDep with string dep', () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep;

    diSet('test', 'test');

    equal(fn(), 'test');
  });
});

test('diDep error when not exists string dep', () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep;

    throws(() => fn());
  });
});

test('diDep with string dep type generic support', () => {
  diInit(() => {
    const fn = (dep = diDep<boolean>('test')) => dep;

    diSet('test', true);

    equal(fn(), true);
  });
});

test('diOnce error before init', () => {
  const fn = diOnce(() => 1);

  throws(() => fn());
});

test('diOnce', () => {
  let i = 0;
  const fn = diOnce((n: number) => {
    i += n;
    return i;
  });

  diInit(() => {
    equal(fn(1), 1);
    equal(fn(1), 1);
    equal(i, 1);
  });
});

test('diOnceSet', () => {
  const fn = diOnce((n: number) => {
    return n + 1;
  });

  diInit(() => {
    diOnceSet(fn, 2);
    equal(fn(4), 2);
  });
});

test('expose als', () => {
  diInit(() => {
    const store = als.getStore();
    equal(store?.deps.toString(), '[object Map]');
    equal(store?.once.toString(), '[object Map]');
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

  equal(i, 1);
  equal((als.run as any).calledOnce, true);

  sinon.restore();
});

test('diExists - false', () => {
  equal(diExists(), false);
});

test('diExists - true', () => {
  diInit(() => {
    equal(diExists(), true);
  });
});

test.run();
