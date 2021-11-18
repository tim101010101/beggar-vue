# 渲染模块1: vnode & render 前置知识

在正式介绍渲染模块前，一些前置知识需要先解释一下

## 虚拟 dom

众所周知，vue 中运用了虚拟 dom 技术来提高性能，不过为什么虚拟 dom 是什么，为什么能提高性能呢，虚拟 dom 是最diao的么

虚拟 dom 技术简而言之指的是**先将需要渲染的 dom 节点在内存中创建好，再通过渲染函数一次性渲染到页面中**。

我们**在 js 中进行的每一次 dom 操作都会引起页面回流或者重绘**，大量的 dom 操作可能最终导致页面卡顿或白屏的情况。虽然目前大部分浏览器都有进行优化，维护一个操作队列，将所有会导致回流或者重绘的操作入队，在某个时机再一次性处理，不过还是有一些操作能够强制进行处理，如 width、height、offsetLeft等。

使用虚拟 dom 技术的话，就可以先在内存中创建好 dom 节点，**操作内存中的 dom 节点比起直接操作页面中的 dom 节点性能要好不少**，以下举个不太恰当的小例子

```js
// 直接操作 dom
console.time('test1');
for (let i = 0; i < 10000; i++) {
    document.querySelector('#test').innerHTML++;
}
console.timeEnd('test1'); // 30ms

// 先在内存中更改，再一次性渲染
console.time('test2');
let num = document.querySelector('#test').innerHTML;
for (let i = 0; i < 10000; i++) {
    num++;
}
document.querySelector('#test').innerHTML = num;
console.timeEnd('test2'); // 0.48ms
```

虚拟 dom 的思想其实很像 java io 中的缓冲流，都是一种缓存的思想，先将内容读取到缓冲区，再一次性写入硬盘，规避频繁的 io 操作，减少 cpu 访问硬盘次数，从而提高性能，虚拟 dom 也是同理。最后举个现实生活中的例子，我们需要一桶水，原生 dom 操作相当于我拿个瓢一次装一瓢水倒进去再回去装一瓢，直到桶装满，而虚拟 dom 技术则是我拿多一个桶装满水，直接搬过去满上，而这也引出了虚拟 dom 技术的缺点

根据以上装水的例子可以看出，虚拟 dom 技术能够减少 dom 操作次数从而提高性能，但操作 dom 的前提是已经渲染完毕页面中已经有元素，虚拟 dom 技术会占用一定的内存用于储存 dom 节点，在页面首屏渲染时由于需要构建虚拟 dom，可能会比原生的 dom 操作还要慢，因此页面中一些静态的元素其实完全可以用原生 dom 操作进行，一些静态页面也没必要使用虚拟 dom 技术

## 用到的一些位运算操作

上面介绍了虚拟 dom 技术，而 dom 节点也有不同的类型，如元素节点 `div`、`span`、`li` 等，也有文本节点，即文本内容，在 vue 组件化开发中也有组件节点，因此则需要一个方式来标注 dom 节点类型，而具体落实到 vue 中则是一个 `ShapeFlags` 枚举类型的数据，如下所示

```ts
// vue-next/packages/shared/src/shapeFlags.ts
export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}
```

图中可以看出，`ShapeFlags` 定义了很多常量并且有一定规律，都是一个 1 然后左移 x 位，且 x 依次递增，如下

```js
ELEMENT: 1,                 // 1
FUNCTION_COMPONENT: 1 << 1, // 10
STATEFUL_COMPONENT: 1 << 2, // 100
TEXT_CHILDREN: 1 << 3,      // 1000
ARRAY_CHILDREN: 1 << 4,     // 10000
...
```

直接说结论，**此处运用左移运算符 `<<` 来使不同位上的 1 作为节点类型的唯一标识，表示不同的节点类型**，如一个数第一位是 1，那他铁定是元素节点，第二位是 1 那就是函数式组件等，那么如何判断一个数第几位是 1 呢

查阅 `vue-next-master/packages/runtime-core` 下的源码时，会发现其中使用了很多按位与操作 `&` 和或等于操作 `|=`，这两个就是使用 `ShapeFlags` 的关键所在，创建出来的虚拟 dom 对象 `vnode` 上都会定义一个 `shapeFlag` 属性，并根据传入的 `type` 的类型进行初始化，由这个属性来定义该节点的节点类型以及子节点的类型，大致操作流程如下

```js
// 创建一个元素节点，子节点为文本节点
let shapeFlag = 0;
shapeFlag |= ShapeFlags.ELEMENT;        // 0 | 1 = 1
shapeFlag |= ShapeFlags.TEXT_CHILDREN;  // 1 | 1000 = 1001
console.log(shapeFlag);                 // 9 -> 1001
```

```js
// 判断该节点的类型及其子节点类型，shapeFlag = 9 -> 1001
if (shapeFlag & ShapeFlag.FUNCTION_COMPONENT) {         // 1001 & 10 = 0 -> false
    // create function component...
} else if (shapeFlag & ShapeFlags.ELEMENT) {            // 1001 & 1 = 1 -> true
    // create element node...
}

if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {            // 1001 & 10000 = 0 -> false
    // create array children...
} else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {      // 1001 & 1000 = 1000 -> true
    // create text children...
}
```

如上所述，**vue 中通过或等于 `|=` 来设置不同的值的"组合"**，如 1001 表示"元素节点，子节点为文本节点"，**按位与 `&` 来判断该 `shapeFlag` 某一位上是否是 1**，以此根据 `ShapeFlags` 来创建不同的节点

## Q&A

Q: 为什么要使用 `1 << x` 这样的表达式，而不直接给个值呢，这样不消耗性能么？
A: 怕我们看他源码的时候看不懂(吧)，也为了以后好维护(吧)，位运算本身性能就好(吧)，应该不是什么大问题(吧)

Q: 为什么要用这样特殊的二进制数来表示不同类型呢，可以用其他方式来标识不同类型么？
A: 个人觉得理论上可以，甚至可以用一个字符串比如 `"ELEMENT+TEXT_CHILDREN"` 之类的来给 `shapeFlag` 赋值，或者搞个数组 `[ ELEMENT, TEXT_CHILDREN ]`，应该都能达到目的，只是赋值和判断的逻辑要对应的发生变化，不过位运算性能肯定比这些字符串拼接字符串比较，数组的 push 什么的要好多了
