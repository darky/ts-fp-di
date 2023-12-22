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

#### Singleton constant for DI scope

```typescript
const cache = dic<number>()

cache(1)
cache() // 1
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

#### Functional reactive programming, mapping

```typescript
const cacheNumber = dic<number>()
const cacheString = diMap(n => `string - ${n}`, cacheNumber)

cacheNumber(5)
cacheString() // "string - 5"

const onceNumber = diOnce((n: number) => {
  return n;
});
const onceString = diMap(n => `string - ${n}`, onceNumber)

onceNumber(5)
onceString() // "string - 5"

const inc = dis((sum, n: number) => sum + n, 0);
const incString = diMap(s => `string - ${s}`, inc)
inc(1);
inc(4);
incString() // "string - 5"

incString.raw(1) // direct call of function, useful for unit tests
```

#### Attach async effect to State

```typescript
const numberState = dic<number>()
const stringState = diMap(n => `string - ${n}`, numberState)
const seState = dic<string>() // will be populated via side effect
const se = dise(
  async (n, s) => `${n} ${s}`, // side effect async function
  seState, // this state will be populated via async response
  n, // optional arg1 for effect function
  s) // optional arg2 for effect function

await se()

seState() // "5 string - 5"
```

## Plugins

Internal AsyncLocalStorage instance exposed as `als` property. You can implement your own plugin around it.

‼️ If you use ts-fp-di with plugins on your project, please consider, that you have only one ts-fp-di *node_module*<br/>
For example you can freeze as singleton you dependency via *package.json* `overrides`

```json
{
  "overrides": {
    "ts-fp-di": "^x.x.x"
  }
}


```

* [ts-fp-di-mikroorm](https://github.com/darky/ts-fp-di-mikroorm) - Use MikroORM Entities inside ts-fp-di State and achieve auto persistence in DB
* [rxjs-wait-next](https://github.com/darky/rxjs-wait-next) - Wait RxJS Subject.next emition for all subscribers
