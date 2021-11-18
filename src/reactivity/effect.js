const effectStack = [];
let activeEffect;

export function effect(fn, scheduler = null) {
  const effectFn = () => {
    try {
      effectStack.push(effectFn);
      activeEffect = effectFn;
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };

  effectFn();
  effectFn.scheduler = scheduler;
  return effectFn;
}

const targetMap = new WeakMap();
// 用于储存副作用函数，建立副作用函数和依赖的关系
// 一个副作用函数可能依赖多个响应式对象，一个响应式对象可能依赖多个属性
// 同一个属性又可能被多个副作用依赖，因此 targetMap 结构如下
// {
//     [target]: { // key 是 reactiveObject，value 是一个 Map
//         [key]: [effectFn.....] // key 是 reactiveObject 的键值，value 是一个 set
//     }
// }
// 使用 WeakMap 的原因：个人猜想是当 reactiveObject 不再使用后不必手动删除，垃圾回收系统会自动回收

export function track(target, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
    // 等价于
    // depsMap = new Map();
    // targetMap.set(target, depsMap);
  }

  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  deps.add(activeEffect);
}

export function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const deps = depsMap.get(key);
  if (!deps) return;

  // 优先执行调度函数, 副作用函数本身
  deps.forEach((effectFn) => {
    effectFn.scheduler ? effectFn.scheduler(effectFn) : effectFn();
  });
}
