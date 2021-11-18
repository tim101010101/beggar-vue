# 响应式模块1: reactive 实现

> 本文对应源码位置
> vue-next/packages/reactivity/src/reactive.ts
> 181 行

个人对响应式数据的理解为，数据更新以及数据获取时能够以某种方式**主动**让使用此数据的代码做出反应，简而言之就是在数据更新以及数据获取时能够执行别的操作，回归到 vue3 当中则是，数据更新时**主动**通过 `trigger` 方法触发依赖函数，获取数据时**主动**通过 `track` 方法将此依赖函数保存下来。

## 前置知识

响应式的核心原理通过 Proxy 和 Reflect 实现，以下内容来自[MDN](https://developer.mozilla.org/zh-CN/)

### Proxy

[Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy) 对象用于创建一个对象的代理，从而实现基本操作的拦截和自定义，如属性查找、赋值、枚举、函数调用等，构造函数：

```js
const p = new Proxy(target, handler)
```

+ target：被代理的目标对象
+ handler：执行各种操作时代理对象的行为，通常是一个以函数作为属性的对象，其中有如下两个属性
  + [handler.get()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get)：用于拦截对象的读取属性操作，即读取此对象的属性时触发
  + [handler.set()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set)：设置属性值操作的捕获器，即修改此对象的属性值时触发

### Reflect

[Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect) 是 ES6 引入的，对反射机制的实现，通过反射可以让程序在运行时能够获取自身的某些信息，vue3 的实现主要用到以下两个 API：

+ [Reflect.get(target, propertyKey[, receiver])](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/get)：从对象中读取一个属性
  + target：需要取值的目标对象
  + propertyKey：需要获取的值的键值
  + receiver：如果 `target` 对象中指定了 `getter`，receiver 则为 `getter` 调用时的 `this` 值
+ [Reflect.set(target, propertyKey, value[, receiver])](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/set)：在对象上设置一个属性
  + target：设置属性的目标对象
  + propertyKey：设置的属性的名称
  + value：设置的值
  + receiver：如果遇到 `setter`，receiver 则为 `setter` 调用时的 `this` 值

## 写来看看

响应式原理的核心是**使用 Proxy 拦截数据的更新和获取操作，再使用 Reflect 完成原本的操作**。这即是数据代理，设置数据代理后，外界对此数据的更新以及获取操作都会经过这层代理，也就是都会执行一遍 `getter` 和 `setter`，因此就可以在 `getter` 和 `setter` 分别调用收集依赖的方法以及触发更新的方法，可以理解为**让这个数据在获取以及更新时顺带执行自定义的函数**

因此我们需要做的事情如下：

1. 创建 `Proxy` 代理目标对象 `target`
2. 定义存取器 `getter` 和 `setter`
3. 在存取器中进行操作，指收集依赖和触发更新
4. 用 `Reflect` 完成原有操作

超简化版的代码如下所示

```js
const reactive = target => {
    return new Proxy(target, {
        get(target, key, receiver) {
            // 收集依赖
            // track(target, key);
            console.log('collect dependencies...');

            const res = Reflect.get(target, key, receiver);

            return res;
        },

        set(target, key, value, receiver) {
            // 此处需要注意小细节：先更新值，再触发更新方法
            const res = Reflect.set(target, key, value, receiver);

            // 触发更新
            // trigger(target, key);
            console.log('trigger update...');

            return res;
        },
    });
};

const obj = reactive({ a: 1, b: 2 });

obj.a = 100; // trigger update...
obj.b = 200; // trigger update...

console.log(obj.a); // collect dependencies...  
                    // 100
console.log(obj.b); // collect dependencies...  
                    // 200
```

由上代码可以看出，在设置 `obj.a` 以及设置 `obj.b` 时，都会打印出 `trigger update...`，而在取值时都会打印出 `collect dependencies...`，并且也会输出修改后的 `obj.a` 以及 `obj.b`，由此就达到了代理数据的目的，而通过 `track` 和 `trigger` 就可以主动通知项目中使用了 `obj` 这个数据的代码进行更新，这样就实现了一个十分十分简易的响应式

## 总结

个人认为 Reflect 只是能和 Proxy 搭配更好的完成了对象中数据的存取操作，而并不是实现的关键核心。vue3 的响应式核心原理即是通过 Proxy 代理目标对象的存取器，拦截存取操作，在执行收集依赖 `track` 以及触发更新 `trigger` 的方法后再完成原先的存取操作。

## Q&A

Q: 为什么使用 Reflect？
A: 单从文档介绍来看，``Reflect.get()`` 以及 `Reflect.set()` 完全可以用 `return obj[key]` 以及 `obj[key]=value` 代替，并且经过测试，上面的测试代码完全没有受到影响，不过为什么 vue3 会选择使用 Reflect 这种看起来更加麻烦的方式来实现呢，个人认为有以下原因（仅个人观点）：

+ **Reflect API 可以更好的增强底层代码的鲁棒性**，使用 Object 的方式有奇怪的问题，比如给一个对象定义多个同名的属性会导致报错
+ **Reflect API 比 Object API 好用**（吧）。Reflect 在 ES6 中被提出，并且正在逐渐取代 Object 的一些 API，通过 MDN 的对比 ([比较 Reflect 和 Object 方法](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect/Comparing_Reflect_and_Object_methods)) 可以看出，Reflect API 基本可以代替原有的 Object API，而且还有额外的扩展方法，比如此处要用到的 `Reflect.get()` 以及 `Reflect.set()`，其两者的大部分差异都集中在返回值类型，大部分 Reflect API 都会返回一个布尔值来表示操作成功与否，而 Object API 的返回值就很奇怪，返回空对象、`undefined`、`null` 之类的。如果使用 Reflect API 则可以通过返回值进行一些流程控制或者判断操作是否符合预期，而大部分 Object API 要做到这一点就蛮麻烦的
+ **Reflect API 统一了对象操作标准**。Reflect API 以函数的形式实现了常用的对象操作，以给对象中属性赋值的操作为例，Reflect 提供了 `Reflect.set()`，而在这之前，有的人用`obj[key]=value`，也有人用 `obj.key=value`，难以形成标准。除此之外 Object 还有很多操作符，如 `delete`、`in` 等，而 Reflect API 则都是以函数的形式来完成这些操作

Q: 就这么简单？？
A: 大错特错，源码中有大量的容错处理和特例处理，而且将 Proxy 的配置对象以及一些其他所需要的对象抽离了出来作为参数接收，而本文为了直观就直接在方法中写了，本篇实现和源码出入还是蛮大的，不过原理都是同一个，简化之后其实差不多就是这样

Q: 你写这么简单会不会出什么问题？
A: 肯定会出问题啊，不然尤大辛辛苦苦写那么多干嘛，不过我这个基本也能用，而且看起来很简洁很清晰，实现的原理也是一致的，差不多得了
