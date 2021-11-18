# 响应式模块3: ref 实现

> 本文对应源码位置
> vue-next/packages/reactivity/src/ref.ts
> 91 行

ref 也是响应式数据的一种，类似于 reactive，不过**通常**用 ref 封装简单数据，如 Number、String、Boolean等，用 reactive **只能**封装对象，如 Object、Array等。而查阅源码可以看到 ref 实际上是 `RefImpl` 的实例对象，因此也就很好实现了

## 逆向分析一下

依然是惯用的自顶向下开始分析，使用 ref 封装一个简单数据

```js
const a = ref(0);

effect(() => {
    console.log(`a.value: ${a.value}`); // a.value: 0
});

a.value = 10; // a.value: 10
a.value = 20; // a.value: 20
```

由此可以初步分析出以下结果：

1. `ref` 函数接收一个值
2. 存取 ref 中的值需要访问其中的 `value` 进行存取
3. 获取数值以及更新数值时也需要进行依赖收集 `track` 或触发更新 `trigger` 的操作

针对以上分析结果可以做出以下构思：

1. 定义一个 `ref` 函数接收传入值，实例化并返回一个 `RefImpl` 对象
2. 在 `RefImpl` 类上至少应有一个 `value` 属性
3. 定义 `value` 的 `getter` 以及 `setter`，在其中进行收集依赖触发更新的操作，并将整个实例对象作为 `target` 传入

## 写写看

完成上述分析之后实现 ref 就是水到渠成的事情了，代码比较简单，应该不需要过多解释，如下

```js
const ref = value => {
    return new RefImpl(value);
};

class RefImpl {
    constructor(value) {
        this._value = value;
    }

    get value() {
        track(this, 'value');
        return this._value;
    }

    set value(newValue) {
        this._value = newValue;
        trigger(this, 'value');
    }
}
```

以上就完成了，不过此处需要提一下，ref 中的数据实际上是储存在 `this._value` 中，通过 `value` 来进行存取是因为类上定义了 value 的 `getter` 和 `setter`，而这两者维护的都是其中的 `_value` 属性，是一种类似代理的关系，"你的钱给我，我帮你花"、"你的笔给我，我帮你签名"，这就是代理
也就是说如果你想的话，也可以实现一个通过 `this.iWantThisValue` 或者 `this.naLaiBaNi` 进行存取的版本

## 跑跑看

拉着上次写过的 effect 部分一起跑个小例子

```js
// test
import { ref } from './ref';
import { effect, track, trigger } from './effect';

const count = ref(1);

effect(() => {
    console.log(`count.value: ${count.value}`); // count.value: 1
});

count.value = 10; // count.value: 10
count.value = 20; // count.value: 20
```

如上，基本没有太大问题，而 ref 中也是可以接收对象的，只需要调用 reactive 即可，源码中还有其他的很多细节，比如通过 `this._isRef` 来避免重复声明 ref 变量，还有数值的懒更新（只有在数据确实发生变化才进行更新），只需要在 `setter` 中做个简单的判断即可，这些并不会影响到核心功能，因此没有进行实现

## 总结

个人感觉，ref 相比之前的 reactive、effect 要简单很多，没有太多的细节需要思考(因为我偷懒了才不需要思考那么多)，核心实现也是很简单粗暴，关键就是要跳出 reactive 的模式去单独封装一个类来实现所需功能
