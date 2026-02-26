import * as parser from '@babel/parser';

// ─── helpers ────────────────────────────────────────────────────────────────
let _stepId = 0;
const uid = () => ++_stepId;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── environments ────────────────────────────────────────────────────────────
class Environment {
  constructor(parent = null, name = 'Global') {
    this.parent = parent;
    this.name = name;
    this.vars = {};
  }
  define(name, value) { this.vars[name] = value; }
  assign(name, value) {
    if (name in this.vars) { this.vars[name] = value; return; }
    if (this.parent) this.parent.assign(name, value);
    else this.vars[name] = value; // global fallback
  }
  lookup(name) {
    if (name in this.vars) return this.vars[name];
    if (this.parent) return this.parent.lookup(name);
    return undefined;
  }
  snapshot() {
    const entries = Object.entries(this.vars).map(([k, v]) => ({
      name: k,
      value: formatValue(v),
      raw: v,
    }));
    return { name: this.name, variables: entries };
  }
}

function formatValue(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return 'ƒ ()';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return '[Object]'; }
  }
  return String(v);
}

// ─── main interpreter ────────────────────────────────────────────────────────
export function interpret(code) {
  _stepId = 0;
  const steps = [];
  let timerIdCounter = 1;

  const state = {
    callStack: [],          // [{id, name, type, env, returnLine}]
    webAPIs: [],            // [{id, name, delay, elapsed, callbackFn, callbackEnv, callbackNode}]
    taskQueue: [],          // [{id, name, callbackFn, callbackEnv, callbackNode}]
    microtaskQueue: [],     // [{id, name, callbackFn, callbackEnv, callbackNode}]
    consoleOutput: [],      // strings
    currentLine: null,
    currentCol: null,
    phase: 'sync',
    description: '',
    highlightLines: [],
  };

  function snap(description, phase = state.phase, extraLines = []) {
    const hl = state.currentLine ? [state.currentLine, ...extraLines] : extraLines;
    steps.push({
      id: uid(),
      callStack: state.callStack.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        variables: f.env.snapshot().variables,
      })),
      executionContextStack: state.callStack.map(f => f.env.snapshot()),
      webAPIs: deepClone(state.webAPIs.map(w => ({
        id: w.id, name: w.name, delay: w.delay,
      }))),
      taskQueue: deepClone(state.taskQueue.map(t => ({ id: t.id, name: t.name }))),
      microtaskQueue: deepClone(state.microtaskQueue.map(t => ({ id: t.id, name: t.name }))),
      consoleOutput: [...state.consoleOutput],
      currentLine: state.currentLine,
      highlightLines: [...new Set(hl)],
      phase,
      description,
    });
  }

  // ── AST evaluator ──────────────────────────────────────────────────────────
  function evaluate(node, env) {
    if (!node) return undefined;

    state.currentLine = node.loc?.start?.line ?? state.currentLine;

    switch (node.type) {
      case 'File':
        return evaluate(node.program, env);

      case 'Program': {
        // Hoist function declarations
        for (const stmt of node.body) {
          if (stmt.type === 'FunctionDeclaration') {
            env.define(stmt.id.name, makeFunction(stmt, env));
          }
        }
        for (const stmt of node.body) {
          if (stmt.type !== 'FunctionDeclaration') {
            evaluate(stmt, env);
          }
        }
        return undefined;
      }

      // ── Declarations ──────────────────────────────────────────────────────
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          state.currentLine = node.loc?.start?.line;
          const val = decl.init ? evaluate(decl.init, env) : undefined;
          if (decl.id.type === 'Identifier') {
            env.define(decl.id.name, val);
            snap(`Declare ${node.kind} ${decl.id.name} = ${formatValue(val)}`);
          }
        }
        return undefined;

      case 'FunctionDeclaration': {
        // For nested fn declarations (top-level ones are already hoisted in Program)
        const fn = env.lookup(node.id.name);
        if (!fn) {
          env.define(node.id.name, makeFunction(node, env));
        }
        snap(`Function "${node.id.name}" declared`);
        return undefined;
      }

      case 'ExpressionStatement':
        return evaluate(node.expression, env);

      case 'BlockStatement': {
        let result;
        for (const stmt of node.body) {
          result = evaluate(stmt, env);
          if (result && result.__return__) return result;
        }
        return result;
      }

      case 'ReturnStatement': {
        const val = node.argument ? evaluate(node.argument, env) : undefined;
        snap(`Return ${formatValue(val)}`);
        return { __return__: true, value: val };
      }

      case 'IfStatement': {
        state.currentLine = node.loc?.start?.line;
        const test = evaluate(node.test, env);
        snap(`if (${formatValue(test)})`);
        if (test) {
          return evaluate(node.consequent, env);
        } else if (node.alternate) {
          return evaluate(node.alternate, env);
        }
        return undefined;
      }

      case 'WhileStatement': {
        let iterations = 0;
        while (evaluate(node.test, env) && iterations < 500) {
          const r = evaluate(node.body, env);
          if (r && r.__return__) return r;
          if (r && r.__break__) break;
          iterations++;
        }
        return undefined;
      }

      case 'ForStatement': {
        const loopEnv = new Environment(env, 'for-loop');
        if (node.init) evaluate(node.init, loopEnv);
        let iterations = 0;
        while ((!node.test || evaluate(node.test, loopEnv)) && iterations < 500) {
          const r = evaluate(node.body, loopEnv);
          if (r && r.__return__) return r;
          if (r && r.__break__) break;
          if (node.update) evaluate(node.update, loopEnv);
          iterations++;
        }
        return undefined;
      }

      case 'BreakStatement':
        return { __break__: true };

      // ── Expressions ───────────────────────────────────────────────────────
      case 'AssignmentExpression': {
        const val = evaluate(node.right, env);
        if (node.left.type === 'Identifier') {
          if (node.operator === '=') env.assign(node.left.name, val);
          else {
            const cur = env.lookup(node.left.name);
            const next = applyOp(node.operator.replace('=', ''), cur, val);
            env.assign(node.left.name, next);
          }
          snap(`${node.left.name} ${node.operator} ${formatValue(val)}`);
          return env.lookup(node.left.name);
        }
        return val;
      }

      case 'BinaryExpression':
        return applyOp(node.operator, evaluate(node.left, env), evaluate(node.right, env));

      case 'LogicalExpression': {
        const left = evaluate(node.left, env);
        if (node.operator === '&&') return left ? evaluate(node.right, env) : left;
        if (node.operator === '||') return left ? left : evaluate(node.right, env);
        return left ?? evaluate(node.right, env);
      }

      case 'UnaryExpression': {
        const arg = evaluate(node.argument, env);
        if (node.operator === '!') return !arg;
        if (node.operator === '-') return -arg;
        if (node.operator === '+') return +arg;
        if (node.operator === 'typeof') return typeof arg;
        return arg;
      }

      case 'UpdateExpression': {
        const name = node.argument.name;
        const cur = env.lookup(name);
        const next = node.operator === '++' ? cur + 1 : cur - 1;
        env.assign(name, next);
        return node.prefix ? next : cur;
      }

      case 'ConditionalExpression': {
        const test = evaluate(node.test, env);
        return evaluate(test ? node.consequent : node.alternate, env);
      }

      case 'TemplateLiteral': {
        let str = '';
        node.quasis.forEach((q, i) => {
          str += q.value.raw;
          if (i < node.expressions.length) {
            str += formatValue(evaluate(node.expressions[i], env));
          }
        });
        return str;
      }

      case 'Identifier':
        if (node.name === 'undefined') return undefined;
        if (node.name === 'null') return null;
        if (node.name === 'Infinity') return Infinity;
        if (node.name === 'NaN') return NaN;
        return env.lookup(node.name);

      case 'NumericLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
        return node.value;

      case 'NullLiteral':
        return null;

      case 'ArrayExpression':
        return node.elements.map(el => el ? evaluate(el, env) : undefined);

      case 'ObjectExpression': {
        const obj = {};
        for (const prop of node.properties) {
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          obj[key] = evaluate(prop.value, env);
        }
        return obj;
      }

      // ── Functions ─────────────────────────────────────────────────────────
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return makeFunction(node, env);

      case 'CallExpression':
        return evaluateCall(node, env);

      case 'MemberExpression': {
        const obj = evaluate(node.object, env);
        const prop = node.computed ? evaluate(node.property, env) : node.property.name;
        if (obj == null) return undefined;
        const val = obj[prop];
        return typeof val === 'function' ? val.bind(obj) : val;
      }

      case 'NewExpression':
        return evaluateNew(node, env);

      case 'AwaitExpression': {
        // We treat await as synchronous for simulation purposes
        const val = evaluate(node.argument, env);
        if (val && val.__promise__) {
          const resolved = val.__value__;
          snap(`await → resumes with ${formatValue(resolved)}`, 'microtask');
          return resolved;
        }
        snap(`await ${formatValue(val)}`);
        return val;
      }

      case 'SequenceExpression': {
        let last;
        for (const expr of node.expressions) last = evaluate(expr, env);
        return last;
      }

      // ── TypeScript-specific nodes ─────────────────────────────────────────
      case 'TSTypeAnnotation':
      case 'TSTypeReference':
      case 'TSStringKeyword':
      case 'TSNumberKeyword':
      case 'TSBooleanKeyword':
      case 'TSAnyKeyword':
      case 'TSVoidKeyword':
      case 'TSNullKeyword':
      case 'TSUndefinedKeyword':
      case 'TSNeverKeyword':
      case 'TSUnknownKeyword':
      case 'TSObjectKeyword':
      case 'TSArrayType':
      case 'TSUnionType':
      case 'TSIntersectionType':
      case 'TSTupleType':
      case 'TSTypeParameterDeclaration':
      case 'TSTypeParameterInstantiation':
      case 'TSTypeParameter':
      case 'TSPropertySignature':
      case 'TSMethodSignature':
      case 'TSQualifiedName':
      case 'TSLiteralType':
      case 'TSFunctionType':
      case 'TSTypeLiteral':
      case 'TSParenthesizedType':
      case 'TSConditionalType':
      case 'TSIndexedAccessType':
      case 'TSMappedType':
        // Type-only nodes: skip at runtime
        return undefined;

      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
      case 'TSTypeAssertion':
        // "expr as Type" / "expr satisfies Type" / "expr!" — evaluate inner
        return evaluate(node.expression, env);

      case 'TSInterfaceDeclaration': {
        snap(`interface ${node.id.name} declared (type-only, erased at runtime)`);
        return undefined;
      }

      case 'TSTypeAliasDeclaration': {
        snap(`type ${node.id.name} declared (type-only, erased at runtime)`);
        return undefined;
      }

      case 'TSEnumDeclaration': {
        const enumObj = {};
        let autoVal = 0;
        for (const member of node.members) {
          const key = member.id.type === 'Identifier' ? member.id.name : member.id.value;
          if (member.initializer) {
            const v = evaluate(member.initializer, env);
            enumObj[key] = v;
            autoVal = typeof v === 'number' ? v + 1 : autoVal;
          } else {
            enumObj[key] = autoVal++;
          }
          // Reverse mapping for numeric enums
          if (typeof enumObj[key] === 'number') {
            enumObj[enumObj[key]] = key;
          }
        }
        env.define(node.id.name, enumObj);
        snap(`enum ${node.id.name} defined`);
        return undefined;
      }

      case 'TSModuleDeclaration': {
        // namespace / module — evaluate the body
        if (node.body) evaluate(node.body, env);
        return undefined;
      }

      case 'TSModuleBlock': {
        for (const stmt of node.body) evaluate(stmt, env);
        return undefined;
      }

      case 'TSExportAssignment':
        return evaluate(node.expression, env);

      case 'TSParameterProperty': {
        // class constructor parameter property: public x: number
        const param = node.parameter;
        if (param.type === 'Identifier') return param.name;
        if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') return param.left.name;
        return undefined;
      }

      default:
        return undefined;
    }
  }

  // ── Function factory ────────────────────────────────────────────────────────
  function makeFunction(node, closureEnv) {
    const fn = function (...args) {
      const name = node.id?.name || node.type === 'ArrowFunctionExpression' ? '(arrow)' : '(anonymous)';
      const funcEnv = new Environment(closureEnv, name === '(arrow)' ? 'Arrow Function' : `Function: ${name || 'anonymous'}`);

      // bind parameters
      const params = node.params || [];
      params.forEach((p, i) => {
        if (p.type === 'Identifier') funcEnv.define(p.name, args[i]);
        else if (p.type === 'AssignmentPattern') {
          const paramName = p.left.type === 'Identifier' ? p.left.name : p.left.left?.name;
          if (paramName) funcEnv.define(paramName, args[i] !== undefined ? args[i] : evaluate(p.right, closureEnv));
        } else if (p.type === 'RestElement') {
          const restName = p.argument.type === 'Identifier' ? p.argument.name : p.argument.left?.name;
          if (restName) funcEnv.define(restName, args.slice(i));
        } else if (p.type === 'TSParameterProperty') {
          // class constructor shorthand: constructor(public x: number)
          const inner = p.parameter;
          if (inner.type === 'Identifier') funcEnv.define(inner.name, args[i]);
          else if (inner.type === 'AssignmentPattern' && inner.left.type === 'Identifier') {
            funcEnv.define(inner.left.name, args[i] !== undefined ? args[i] : evaluate(inner.right, closureEnv));
          }
        }
      });

      const frameId = uid();
      const frame = { id: frameId, name: name || 'anonymous', type: 'function', env: funcEnv };
      state.callStack.push(frame);
      snap(`Call "${frame.name}" → push to Call Stack`, 'sync');

      let result;
      try {
        if (node.body.type === 'BlockStatement') {
          result = evaluate(node.body, funcEnv);
        } else {
          // concise arrow body
          result = evaluate(node.body, funcEnv);
          result = { __return__: true, value: result };
        }
      } finally {
        state.callStack.pop();
        snap(`"${frame.name}" returned → pop from Call Stack`, 'sync');
      }
      return result?.__return__ ? result.value : result;
    };
    fn.__node__ = node;
    fn.__env__ = closureEnv;
    return fn;
  }

  // ── Call expression evaluator ───────────────────────────────────────────────
  function evaluateCall(node, env) {
    state.currentLine = node.loc?.start?.line;

    // console.log
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.object.name === 'console' &&
      node.callee.property.name === 'log'
    ) {
      const args = node.arguments.map(a => evaluate(a, env));
      const msg = args.map(formatValue).join(' ');
      state.consoleOutput.push(msg);
      snap(`console.log(${msg})`);
      return undefined;
    }

    // setTimeout
    if (node.callee.type === 'Identifier' && node.callee.name === 'setTimeout') {
      const [callbackArg, delayArg] = node.arguments;
      const callback = evaluate(callbackArg, env);
      const delay = delayArg ? evaluate(delayArg, env) : 0;
      const tid = timerIdCounter++;
      const timerName = `Timer(${delay}ms)`;
      state.webAPIs.push({
        id: tid, name: timerName, delay,
        callbackFn: callback, callbackEnv: env,
        callbackNode: callbackArg,
      });
      snap(`setTimeout(fn, ${delay}) → sent to Web APIs`, 'webapi');

      // Simulate: after sync code, move to task queue
      // We schedule the callback to run at end of sync phase via a deferred marker
      setTimeout_deferred.push({ id: tid, name: timerName, delay, callbackFn: callback });
      return tid;
    }

    // setInterval (simplified: fires once)
    if (node.callee.type === 'Identifier' && node.callee.name === 'setInterval') {
      const [callbackArg, delayArg] = node.arguments;
      const callback = evaluate(callbackArg, env);
      const delay = delayArg ? evaluate(delayArg, env) : 0;
      const tid = timerIdCounter++;
      const timerName = `Interval(${delay}ms)`;
      state.webAPIs.push({ id: tid, name: timerName, delay, callbackFn: callback });
      snap(`setInterval(fn, ${delay}) → sent to Web APIs`, 'webapi');
      setTimeout_deferred.push({ id: tid, name: timerName, delay, callbackFn: callback });
      return tid;
    }

    // clearTimeout
    if (node.callee.type === 'Identifier' && node.callee.name === 'clearTimeout') {
      const id = evaluate(node.arguments[0], env);
      state.webAPIs = state.webAPIs.filter(w => w.id !== id);
      snap(`clearTimeout(${id})`);
      return undefined;
    }

    // Promise.resolve / Promise.reject
    if (
      node.callee.type === 'MemberExpression' &&
      node.callee.object.name === 'Promise'
    ) {
      const method = node.callee.property.name;
      if (method === 'resolve') {
        const val = node.arguments[0] ? evaluate(node.arguments[0], env) : undefined;
        snap(`Promise.resolve(${formatValue(val)})`);
        return makeResolvedPromise(val);
      }
      if (method === 'reject') {
        const val = node.arguments[0] ? evaluate(node.arguments[0], env) : undefined;
        snap(`Promise.reject(${formatValue(val)})`);
        return makeRejectedPromise(val);
      }
    }

    // queueMicrotask
    if (node.callee.type === 'Identifier' && node.callee.name === 'queueMicrotask') {
      const callback = evaluate(node.arguments[0], env);
      const mid = uid();
      state.microtaskQueue.push({ id: mid, name: 'queueMicrotask cb', callbackFn: callback });
      snap(`queueMicrotask(fn) → Microtask Queue`, 'microtask');
      microtask_deferred.push({ id: mid, name: 'queueMicrotask cb', callbackFn: callback });
      return undefined;
    }

    // generic call
    const callee = node.callee.type === 'MemberExpression'
      ? (() => {
          const obj = evaluate(node.callee.object, env);
          const prop = node.callee.computed
            ? evaluate(node.callee.property, env)
            : node.callee.property.name;
          if (obj == null) return undefined;

          // Array methods
          if (Array.isArray(obj)) {
            return (...args) => {
              const fn = obj[prop];
              return typeof fn === 'function' ? fn.apply(obj, args) : undefined;
            };
          }
          // Promise .then / .catch / .finally
          if (obj && obj.__promise__) {
            if (prop === 'then') {
              return (...args) => {
                const [onFulfill] = args;
                const mid = uid();
                const name = 'Promise.then cb';
                microtask_deferred.push({ id: mid, name, callbackFn: onFulfill, arg: obj.__value__ });
                state.microtaskQueue.push({ id: mid, name });
                snap(`Promise.then → Microtask Queue`, 'microtask');
                return makeResolvedPromise(undefined);
              };
            }
            if (prop === 'catch') {
              return (...args) => {
                snap(`Promise.catch registered`);
                return makeResolvedPromise(undefined);
              };
            }
            if (prop === 'finally') {
              return (...args) => {
                snap(`Promise.finally registered`);
                return makeResolvedPromise(undefined);
              };
            }
          }
          const fn = obj[prop];
          if (typeof fn === 'function') return fn.bind(obj);
          return fn;
        })()
      : env.lookup(node.callee.name);

    if (typeof callee !== 'function') {
      const name = node.callee.type === 'Identifier' ? node.callee.name : 'unknown';
      snap(`[Error] "${name}" is not a function`, 'sync');
      return undefined;
    }

    const args = node.arguments.map(a =>
      a.type === 'SpreadElement' ? [...evaluate(a.argument, env)] : evaluate(a, env)
    ).flat(0);

    return callee(...args);
  }

  // ── new Expression ──────────────────────────────────────────────────────────
  function evaluateNew(node, env) {
    state.currentLine = node.loc?.start?.line;
    const calleeName = node.callee.name || 'Constructor';

    // new Promise(executor)
    if (calleeName === 'Promise') {
      snap(`new Promise(executor) created`);
      const executor = evaluate(node.arguments[0], env);
      let resolvedVal;
      let rejectedVal;
      let settled = false;

      const resolve = (val) => {
        resolvedVal = val;
        settled = true;
        snap(`Promise resolved with ${formatValue(val)}`, 'microtask');
      };
      const reject = (val) => {
        rejectedVal = val;
        settled = true;
        snap(`Promise rejected with ${formatValue(val)}`, 'microtask');
      };

      if (typeof executor === 'function') {
        executor(resolve, reject);
      }

      const p = makeResolvedPromise(resolvedVal);
      p.__resolved__ = settled;
      p.__rejected__ = !!rejectedVal;
      return p;
    }

    const ctor = env.lookup(calleeName);
    if (typeof ctor === 'function') {
      const result = ctor();
      snap(`new ${calleeName}()`);
      return result;
    }
    return {};
  }

  // ── Promise primitives ──────────────────────────────────────────────────────
  function makeResolvedPromise(value) {
    return { __promise__: true, __value__: value, __state__: 'fulfilled' };
  }
  function makeRejectedPromise(reason) {
    return { __promise__: true, __reason__: reason, __state__: 'rejected' };
  }

  // ── Operator helper ─────────────────────────────────────────────────────────
  function applyOp(op, left, right) {
    /* eslint-disable eqeqeq */
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case '%': return left % right;
      case '**': return left ** right;
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '&': return left & right;
      case '|': return left | right;
      case '^': return left ^ right;
      case '<<': return left << right;
      case '>>': return left >> right;
      default: return undefined;
    }
  }

  // ── Deferred collections ────────────────────────────────────────────────────
  const setTimeout_deferred = [];
  const microtask_deferred = [];

  // ── Parse and execute ───────────────────────────────────────────────────────
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'asyncGenerators', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch (e) {
    return [{
      id: 1, callStack: [], executionContextStack: [],
      webAPIs: [], taskQueue: [], microtaskQueue: [],
      consoleOutput: [`Parse Error: ${e.message}`],
      currentLine: 1, highlightLines: [1], phase: 'sync',
      description: `Parse Error: ${e.message}`,
    }];
  }

  // Global execution context
  const globalEnv = new Environment(null, 'Global');
  const globalFrame = { id: uid(), name: 'Global', type: 'global', env: globalEnv };
  state.callStack.push(globalFrame);
  snap('Global Execution Context created', 'sync');

  // Run synchronous code
  try {
    evaluate(ast, globalEnv);
  } catch (e) {
    state.consoleOutput.push(`Runtime Error: ${e.message}`);
    snap(`Runtime Error: ${e.message}`, 'sync');
  }

  // Sort deferred by delay then move webAPIs → taskQueue
  setTimeout_deferred.sort((a, b) => a.delay - b.delay);

  // Finish sync: pop global only after all macro/micro tasks
  // Show "call stack empty, checking queues" if there are deferred tasks
  if (setTimeout_deferred.length > 0 || microtask_deferred.length > 0) {
    // Drain microtasks first
    while (microtask_deferred.length > 0) {
      const mt = microtask_deferred.shift();
      state.microtaskQueue = state.microtaskQueue.filter(m => m.id !== mt.id);
      snap(`Event Loop: Drain microtask "${mt.name}"`, 'microtask');

      if (typeof mt.callbackFn === 'function') {
        try {
          if (mt.arg !== undefined) mt.callbackFn(mt.arg);
          else mt.callbackFn();
        } catch (e) {
          state.consoleOutput.push(`Microtask Error: ${e.message}`);
        }
        snap(`Microtask "${mt.name}" done`, 'microtask');
      }
    }

    // Process macro tasks (setTimeout callbacks)
    for (const timer of setTimeout_deferred) {
      // Move from WebAPIs to TaskQueue
      state.webAPIs = state.webAPIs.filter(w => w.id !== timer.id);
      state.taskQueue.push({ id: timer.id, name: timer.name });
      snap(`Web API: Timer expired → "${timer.name}" moved to Task Queue`, 'taskqueue');

      // Event loop picks it up
      state.taskQueue.shift();
      snap(`Event Loop: Dequeue "${timer.name}" from Task Queue`, 'eventloop');

      if (typeof timer.callbackFn === 'function') {
        try {
          // callbackFn was created by makeFunction — it manages its own stack frames
          timer.callbackFn();
        } catch (e) {
          state.consoleOutput.push(`Task Error: ${e.message}`);
        }
        snap(`"${timer.name}" callback complete`, 'taskqueue');
      }

      // Drain microtasks after each macro task
      while (microtask_deferred.length > 0) {
        const mt = microtask_deferred.shift();
        state.microtaskQueue = state.microtaskQueue.filter(m => m.id !== mt.id);
        snap(`Event Loop: Drain microtask "${mt.name}" after macro task`, 'microtask');
        if (typeof mt.callbackFn === 'function') {
          try {
            if (mt.arg !== undefined) mt.callbackFn(mt.arg);
            else mt.callbackFn();
          } catch (e) {
            state.consoleOutput.push(`Microtask Error: ${e.message}`);
          }
          snap(`Microtask "${mt.name}" done`, 'microtask');
        }
      }
    }
  }

  // Pop global context at end
  state.callStack.pop();
  snap('All code executed. Call Stack empty.', 'done');

  return steps;
}
