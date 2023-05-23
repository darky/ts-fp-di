# ts-fp-di
Tiny TypeScript functional dependency injection, based on Node.js AsyncLocalStorage.

## Get started
Firstly, need init DI container for each life cycle of your backend application (each HTTP request/response, handle MQ message, ...).

Example of middleware for typical Koa application, where on each HTTP request will be created particular DI container:

```typescript
app.use(async (ctx, next) => {
  await diInit(async () => return await next());
});
```

Further, simply use **ts-fp-di** API "as is" in code, it will consider particular DI scope.

## Examples

#### Basic

```typescript
const fn = di(() => 1);
fn() // call `fn` function inside DI scope, it's return 1
```

#### Override dependency (method 1)

```typescript
const fn = di(() => 1);
diSet(fn, () => 2); // Override `fn` function inside DI scope. Useful for unit tests.
fn() // returns 2, because it rewriten.
```

#### Override dependency (method 2)

```typescript
const fn = () => 1;
diSet(fn, () => 2); // Override `fn` function inside DI scope. Useful for unit tests.
diDep(fn)() // returns 2, because it rewriten.
```

#### Dependency by string key

```typescript
diSet('user', {login: 'xxx'}); // Useful to setup current user in DI scope
diDep<User>('user') // Extract current user from anywhere
```

#### State managment in DI scope

```typescript
// setup Redux like state with reducer in DI scope
const inc = dis((sum, n: number) => sum + n, 0); 
inc(1); // mutate state
inc(); // 1, "inc" without argument returns current state
```

#### State managment in global scope

```typescript
// setup Redux like state with reducer in global scope (pass true as isGlobal flag)
const inc = dis((sum, n: number) => sum + n, 0, true); 
inc(1); // mutate state
inc(); // 1, "inc" without argument returns current state

clearGlobalState(); // you can clear global state (useful in tests)
inc() // 0, "inc" returns default value now
```

#### Singleton for DI scope

```typescript
let i = 0;
const fn = diOnce(() => { // <- setup Singleton function for DI scope
  i += 1;
  return i;
});

fn(); // 1
fn(); // also 1, because fn is singleton for DI scope
```

#### Override Singleton for DI scope

```typescript
const fn = diOnce((n: number) => { // <- setup Singleton function for DI scope
  return n + 1;
});

diOnceSet(fn, -1); // Override diOnceSet. For example, use this in your unit tests
fn(4) // -1 instead 5, because -1 set on prev line
```

#### Check that runtime in DI scope

```typescript
diExists() // false

diInit(() => {
  diExists() // true
});
```

#### Share DI context

```typescript
const ctx = diContext()

diInit(() => {
  // ctx will be considered here
}, ctx)

diInit(() => {
  // same ctx will be considered here too
}, ctx)
```

#### DI Scope (OOP incapsulation alternative)

```typescript
const inc = dis((resp: number, n: number) => resp + n, 0)

const scope = diScope({ inc }, () => {
  // optional "constructor" function
  // some `diSet` can be used here
})

scope.inc(5) // this mutation occur only inside this scope
scope.inc() // 5 
```

## Plugins

Internal AsyncLocalStorage instance exposed as `als` property. You can implement your own plugin around it.

## Related

* [effector-async-local-storage](https://github.com/darky/effector-async-local-storage) - Effector Domain based on AsyncLocalStorage

* [effector-storify](https://github.com/darky/effector-storify) - Effector utils for storify Effect/Event
