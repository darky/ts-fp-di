# ts-fp-di
Tiny TypeScript functional dependency injection, based on Node.js AsyncLocalStorage

## Examples

#### Basic

```typescript
diInit(() => { // <- Init DI scope. For example, use this in your Express middleware on each request
  const depFn = () => 1;

  const fn = () => diDep(depFn)();

  fn() // 1
});
```

#### Override dep

```typescript
diInit(() => { // <- Init DI scope. For example, use this in your Express middleware on each request
  const depFn = () => 1;

  const fn = () => diDep(depFn)();

  diSet(depFn, () => 2); // <- Override depFn. For example, use this in your unit tests

  fn(); // 2
});
```

#### Dep by string key

```typescript
diInit(() => {
  const fn = () => diDep<boolean>('test');

  diSet('test', true);

  fn() // true
});
```

#### Singleton for DI scope

```typescript
let i = 0;
const fn = diOnce(() => { // <- setup Singleton function for DI scope
  i += 1;
  return i;
});

diInit(() => {
  fn(); // 1
  fn(); // also 1, because fn is singleton for DI scope
  i // 1, because fn is signleton for DI scope
});
```
