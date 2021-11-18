import { hasChanged, isObject } from '../utils';
import { reactive } from './reactive';
import { track, trigger } from './effect';

export function ref(value) {
  if (isRef(value)) {
    return value;
  }
  return new RefImpl(value);
}

class RefImpl {
  constructor(value) {
    this.__isRef = true;
    this.__value = convert(value);
  }
  get value() {
    track(this, 'value');
    return this.__value;
  }
  set value(newValue) {
    if (hasChanged(newValue, this.__value)) {
      this.__value = convert(newValue);
      trigger(this, 'value');
    }
  }
}

// 如果是一个对象则返回 reactive 响应式
function convert(value) {
  return isObject(value) ? reactive(value) : value;
}

// TODO
const shallowUnwrapHandlers = {
  get(target, key, receiver) {
    // 如果是 ref 类型直接返回 .value
    // 如果不是就返回 value
    return unRef(Reflect.get(target, key, receiver));
  },

  set(target, key, value, receiver) {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      return (target[key].value = value);
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  }
};

// TODO
// 代理 ref
// 自动解构 ref
// 比如在 template 里使用 ref 就不需要加 .value
export function proxyRefs(objectWithRefs) {
  return new Proxy(objectWithRefs, shallowUnwrapHandlers);
}

export function isRef(value) {
  return !!(value && value.__isRef);
}

// 自动拆箱
export function unRef(ref) {
  return isRef(ref) ? ref.value : ref;
}
