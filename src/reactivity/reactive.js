import { isObject, hasChanged, isArray } from '../utils';
import { track, trigger } from './effect';

const proxyMap = new WeakMap();

export function reactive(target) {
  if (!isObject(target)) {
    return target;
  }

  // 特例处理 reactive(reactive(xxx))
  if (isReactive(target)) {
    return target;
  }

  // 特例处理 let a = reactive(obj); let b = reactive(obj)
  if (proxyMap.has(target)) {
    return proxyMap.get(target);
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === '__isReactive') {
        return true;
      }
      track(target, key);

      const res = Reflect.get(target, key, receiver);

      // 特例处理 let a = reactive({ a: { b: 10 } })
      // 深层代理，只有在被依赖时才会进行递归代理
      return isObject(res) ? reactive(res) : res;
    },
    set(target, key, value, receiver) {
      let oldLength = target.length;
      const oldValue = target[key];
      const res = Reflect.set(target, key, value, receiver);

      if (hasChanged(oldValue, value)) {
        trigger(target, key);
        // 如果将数组作为响应式对象，则根据长度是否变化手动触发更新
        if (isArray(target) && hasChanged(oldLength, target.length)) {
          trigger(target, 'length');
        }
      }

      return res;
    }
  });

  proxyMap.set(target, proxy);
  return proxy;
}

export function isReactive(target) {
  return !!(target && target.__isReactive);
}
