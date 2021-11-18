import { isObject, hasChanged } from '../utils';
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
    this._value = convert(value);
  }

  get value() {
    track(this, 'value');
    return this._value;
  }
  set value(newValue) {
    if (hasChanged(newValue, this._value)) {
      // 传递的值有可能是对象，用 convert 做处理
      this._value = convert(newValue);
      // 赋值完毕后再触发更新，否则无法得到新值
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

export function unRef(ref) {
  return isRef(ref) ? ref.value : ref;
}
