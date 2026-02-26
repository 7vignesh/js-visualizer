export const SAMPLES = [
  {
    label: 'Call Stack Basics',
    code: `function greet(name) {
  const msg = "Hello, " + name + "!";
  console.log(msg);
  return msg;
}

function main() {
  const result = greet("World");
  console.log("Result:", result);
}

main();`
  },
  {
    label: 'setTimeout & Event Loop',
    code: `console.log("Start");

setTimeout(function taskCallback() {
  console.log("Timeout callback - Task Queue");
}, 1000);

console.log("End");`
  },
  {
    label: 'Microtask vs Task',
    code: `console.log("1: Script start");

setTimeout(function macroTask() {
  console.log("4: setTimeout callback");
}, 0);

Promise.resolve().then(function microTask1() {
  console.log("3: Promise.then callback");
});

console.log("2: Script end");`
  },
  {
    label: 'Closure & Scope',
    code: `function makeCounter() {
  let count = 0;
  
  function increment() {
    count = count + 1;
    console.log("Count:", count);
    return count;
  }
  
  return increment;
}

const counter = makeCounter();
counter();
counter();
counter();`
  },
  {
    label: 'Async / Await',
    code: `console.log("Before async");

async function fetchData() {
  console.log("Inside async function");
  const result = await Promise.resolve(42);
  console.log("Awaited value:", result);
  return result;
}

fetchData();

console.log("After async call");`
  },
  {
    label: 'Nested Functions',
    code: `function outer() {
  const x = 10;
  
  function inner() {
    const y = 20;
    const sum = x + y;
    console.log("Sum:", sum);
    return sum;
  }
  
  return inner();
}

const result = outer();
console.log("Final:", result);`
  },
  {
    label: 'TS: Types & Interfaces',
    lang: 'ts',
    code: `interface User {
  name: string;
  age: number;
}

function greetUser(user: User): string {
  const msg = "Hello, " + user.name + "! Age: " + user.age;
  console.log(msg);
  return msg;
}

const alice: User = { name: "Alice", age: 30 };
const result = greetUser(alice);
console.log("Returned:", result);`
  },
  {
    label: 'TS: Enum & Generics',
    lang: 'ts',
    code: `enum Direction {
  Up,
  Down,
  Left,
  Right
}

function identity<T>(value: T): T {
  console.log("identity called with:", value);
  return value;
}

const dir = identity(Direction.Up);
console.log("Direction:", dir);

const name = identity("TypeScript");
console.log("Name:", name);`
  },
  {
    label: 'TS: Type Alias & Assertion',
    lang: 'ts',
    code: `type StringOrNumber = string | number;

function double(x: StringOrNumber): StringOrNumber {
  if (typeof x === "number") {
    const result = x * 2;
    console.log("Doubled number:", result);
    return result;
  }
  const result = x + x;
  console.log("Doubled string:", result);
  return result;
}

const a = double(21);
const b = double("ha");
console.log("a =", a, "b =", b);`
  },
];
