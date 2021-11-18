import { effect, track, trigger } from './effect';

export const computed = (getter) => {
  return new ComputedRefImpl(getter);
};

class ComputedRefImpl {
  constructor(getter) {
    this._dirty = true;
    this.effect = effect(getter, () => {
      // scheduler
      if (!this._dirty) {
        // 锁开了
        this._dirty = true;
        trigger(this, 'value');
      }
    });
  }

  get value() {
    if (this._dirty) {
      this._value = this.effect();
      // 锁上了
      this._dirty = false;
      track(this, 'value');
    }
    return this._value;
  }
}
