import { test } from "uvu";
import { equal, throws } from "uvu/assert";

import { diInit, diDep, diSet } from "./index.js";

test("diDep error before init", () => {
  const depFn = () => 1;

  const fn = (dep = diDep(depFn)) => dep();

  throws(() => fn());
});

test("diSet error before init", () => {
  const depFn = () => 1;

  throws(() => diSet(depFn, () => 2));
});

test("diDep with default fn", () => {
  diInit(() => {
    const depFn = () => 1;

    const fn = (dep = diDep(depFn)) => dep();

    equal(fn(), 1);
  });
});

test("diDep with override fn", () => {
  diInit(() => {
    const depFn = () => 1;

    const fn = (dep = diDep(depFn)) => dep();

    diSet(depFn, () => 2)

    equal(fn(), 2);
  });
});

test("diDep with string dep", () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep;

    diSet('test', 'test');

    equal(fn(), 'test');
  });
});

test("diDep error when not exists string dep", () => {
  diInit(() => {
    const fn = (dep = diDep('test')) => dep;

    throws(() => fn());
  });
});

test("diDep with string dep type generic support", () => {
  diInit(() => {
    const fn = (dep = diDep<boolean>('test')) => dep;

    diSet('test', true);

    equal(fn(), true);
  });
});

test.run();