import { effect, track, trigger } from './effect';

export function computed(getter) {
  return new ComputedRefImpl(getter);
}

class ComputedRefImpl {
  constructor(getter) {
    this._dirty = true;
    this.effect = effect(getter, () => {
      // scheduler
      if (!this._dirty) {
        // 锁打开了
        this._dirty = true;
        trigger(this, 'value');
      }
    });
  }

  get value() {
    // 依赖更新，重新计算
    if (this._dirty) {
      // 计算并缓存最新的值
      this._value = this.effect();
      // 锁上了
      this._dirty = false;
      track(this, 'value');
    }
    return this._value;
  }
}
