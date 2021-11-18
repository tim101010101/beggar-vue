# 总结

本篇总结一下整个 beggar-vue 的实现，会有些乱，但都是干货

## reactivity

> vue-next/packages/reactivity/src

响应式模块中我们实现了 reactive、effect、ref、computed，其中最核心的是 effect

### reactive

reactive 我们做了简化，没有进行容错处理和特例处理，也因此整体结构非常清晰简单，通过 `Proxy` 代理 `target` 目标对象的存取操作，在其中进行依赖收集 `track` 以及触发更新 `trigger`

### effect

effect 中使用 `track` 收集依赖，`trigger` 触发依赖更新，再通过 `effect` 将这两者联系起来

vue3 的响应式原理必须把存取操作和 effect 联系起来作为一个整体来看，在调用 `getter` 时，会将当前 `target` 目标对象、`key`、以及 `effectFn` 这三者之间映射关系存起来，称为依赖收集，而调用 `setter` 时，会通过 `trigger` 触发依赖更新。

这里暂且不考虑其他情况，简单一点说，`effect` 包裹的函数 `effectFn` 会通过 `track` 存入 `targetMap`，而在响应式数据发生改变调用 `trigger` 时会将 `targetMap` 中的 `effectFn` 全部执行一次，这样就实现了数据响应式。

### vue3 VS vue2

而对比之前的 vue2 的 `Object.defineProperty`，vue3 的 `Proxy` 实现显然是更优雅更巧妙的，一方面可以直接代理新添加或删除的数据，也不需要为了处理数组而重写大量数组方法，此外 vue2 的响应式在面对多层属性嵌套时需要遍历所有属性通过 `Object.defineProperty` 分别定义 `getter` 和 `setter`，vue3 的响应式性能显然比这个要好，硬要挑刺的话也就是对 IE 过敏，但这都 2021 了，谁还用 IE 啊(dege)

### ref

ref 和 reactive 类似都是响应式数据，原理也相似，但也只是相似而已，因为 ref 的实现原理其实是 `RefImpl` 这个类上的一个 `value` 属性的 `getter` 和 `setter`，而 `reactive` 的原理是 `Proxy`，这是有一定区别的，此外最明显的区别就是 ref 可以直接定义简单类型的数据，如 Number、String、Boolean 等，而 reactive 只能定义复杂类型的数据，如 Object、Array，但这里要注意，ref 也能定义复杂类型的数据，只不过返回的是一个 reactive 罢了

### computed

computed 的实现原理也是 `getter` 和 `setter`，通常用来处理一对多的依赖关系，而 `computed` 最最最重要的点在于他有一个缓存机制，通过 `_dirty` 来标识当前是否需要重新计算，不需要计算的话就直接返回上次计算的值，这是一个很关键的点，也是他和其他响应式数据最大的区别

## runtime

> vue-next/packages/runtime-core/src

运行时模块我们做了很多事情，实现了一个简易的 VNode 系统，如 h、render、patch、component 等，这些都非常重要，并且联系非常紧密，需要将这整个模块作为一个整体来看

### VNode

在正式开始 runtime 模块的实现前，我用了一篇前置篇来专门介绍关于 VNode 的知识，也就是虚拟 DOM。这里依然需要再明确一下，实际上虚拟 DOM 技术并不一定在什么时候都比原生 DOM 操作要快，因为在挂载元素时还需要先生成一棵 VNode-Tree，虚拟 DOM 的优势体现在需要频繁更新页面视图的时候，先修改 VNode-Tree，再一次性将更改内容反映到页面视图上，减少了 DOM 操作次数，这非常非常重要

### patch

patch 显然是这个模块中最为复杂的一个部分，包括广义 `patch` 函数和 diff 算法，`patch` 实际上流程总结下来就是努力的寻找有没有复用节点的机会，有的话就复用节点，实在不行再挂载，而 diff 的话不是三言两语说得清楚的，还是建议多看看我前面的 diff 实现，简单的概括一下的话最关键的是一个最大上升子序列的思想，如果节点在 LIS 上则意味着不需要移动位置，不在 LIS 上就意味着要移动位置，我在讲解 diff 的正文中将这个称为局部有序。而在这里需要提醒一下，一定要想清楚各个变量各个数据结构的作用，比如 `newIndexToOldIndexMap`、`keyToNewIndexMap`、`maxNewIndexSoFar` 这几个非常非常重要的数据一定要理解透彻，不然真的看不懂 diff 算法在干什么

### component

component 组件渲染的话实现起来其实是简单的，但这里我主要想传达一下自己的想法，就是在这一篇正文中我给组件下的定义是 "在同一个上下文环境内且有数据流通的复数元素集合体"，我也举了例子，一些堆砌在一起的元素本身没有意义，有了数据流通就成为一个整体称为组件，一些 VNode 对象混在一起本身没有意义，有了数据共享数据流通就成了一个整体称为组件，当然这只是我的个人想法和个人理解而已。此外就是组件从代码的角度来说只是一个实例对象，上面保存了渲染它需要的数据，仅此而已

## compile

> vue-next/packages/compile-core/src

这个是噩梦啊这个，transform 的复杂程度超出了我的想象，属于是我知道他在干什么，但我不知道他为什么要这么做，因此这里我也不敢大小声，就简单说一下自己的理解，这里也解释一下，我的 compile 模块实现很烂，真的很烂，因为 tranform 的数据相互耦合十分复杂，要不就全都一起实现，要不就简化成我正文中那样惨不忍睹的样子，也因此我的 compile 模块实现更像是为了 generate 而 generate，所以我不建议仔细研究我的代码，能看懂我的代码，就能大概了解清楚源码的流程了，更建议直接研究源码

### AST

整个 compile 模块主要就三个部分 parse、transform、codegen，这三兄弟其实都是围着 AST 转的，我在 compile 模块的前置专门用了一篇文章来科普编译原理相关的内容以及 AST 相关的内容，没有很深入，因为我水平有限，但看懂之后来看 compile 模块基本够用了

AST 抽象语法树，抽象的表示编程语言语法结构的一个树状结构，通过 parse 解析获得，但这只是一个中间产物，我们编译的最终目的还是生成目标代码。而为了更好的生成代码、生成更好的代码，就需要对 AST 进行一些特殊处理，称为 transform，经过处理之后就可以通过 generate 进行代码生成，最终产生目标代码，至此就完成了编译工作

### parse

parse 做的事情非常简单，简言之就是不断分割 `template` 模板字符串，提取需要的信息生成 AST，这是整个 compile 的基础。这时的 AST 其实已经可以直接拿去生成代码了，但是 vue3 对其进行了 transform 转换来方便后面的 `generate` 代码生成环节，同时打上 `patchFlag` 进行优化，当然也支持了一些其他的优化策略

### transform

transform 做的事情就非常复杂了，我们来高度概括一下 transform 干了哪些事情

+ AST 结构转换
  + 编译节点
  + 编译文本
  + 编译指令
+ 提供运行时优化支持
  + patchFlag
  + 静态节点提升
  + 缓存事件处理函数
+ 维护 helpers

大概就是以上这些，先不谈性能优化和 helpers，整个 transform 最主要的目的个人认为是进行 AST 的结构转换，具体一点就是生成节点对应的 `codegenNode` 节点，在正文中我也反复提到，经过 parse 生成的 AST 是以功能为出发点构建的，节点分为元素、文本、属性、指令等，而这并不利于后面的 generate 代码生成，因为代码生成需要的是这个节点的结构，因此 `codegenNode` 就提供了结构，比如函数调用节点、对象节点、数组节点等等，这能最大程度复用函数。而这样进一步基于结构细分节点类型的好处就是操作起来会非常灵活，需要扩展的话也会非常方便，可维护性好，比如后面需要扩展一个什么特殊节点需要数组结构，只需要调用之前定义好的 `genArrayExpression` 即可，而唯一的坏处看起来也就是增加了代码的复杂性，但对于一个库来说，这肯定是划算的，毕竟我口中的 "复杂" 也只是我认为的 "复杂"。

### transform plugins

再说一下转换插件 `transform plugins`，目前来说转换插件有两种类型，节点转换插件和指令转换插件，做的事情老实说都大同小异，一方面进行一些特殊处理，另一方面最主要的就是根据当前节点对应代码的所需结构包装节点，如果理解了我上面说的那一段话，这里你肯定也能明白我的意思，比如 `codegenNode` 节点都是 `VNODE_CALL` 类型，意思是 "这是一个需要调用某个 helpers 函数生成的节点"，而不是 "这是一个xxx节点"，由此就淡化了节点本身的功能性，而把关注重点放在了节点对应的代码结构上。此外再提一嘴，这个转换插件的调用蛮有意思的，可以仔细看看我的正文

### generate

经过前面的 transform 转换之后，generate 代码生成会非常的顺理成章也非常顺利，但我正文实现的时候偷懒太多，没办法按照源码思路实现，因此就写的很烂。说老实话，我的这部分代码没什么参考意义，你来的话肯定可以写个更好的，因此更建议理解了前面 transform 之后直接去看源码中的 generate，肯定一看就懂，我打包票

### optimization

接着总还是得扯点性能优化相关的东西，实际上 compile 阶段做的性能优化大部分在为运行时服务，比如 `patchFlag`，再比如静态提升和事件处理函数的缓存，`patchFlag` 主要为 diff 服务暂且不谈，后两者都是经典的空间换时间，缓存思想嘛，现在的计算机内存越来越大，因此空间换时间其实是比较划算的，可惜我一个都没实现 :)

`patchFlag` 和之前的 `shapeFlag` 非常像，我最开始在写 patch 的时候看混了还懵了半天，这两者结构原理也非常像，都是一个枚举类型，实际上是一个 `bitMap` 位图，只不过意义不同罢了，这个具体还是看我 VNode 的前置知识篇，里面有详细解释。`patchFlag` 标识当前元素所需的 diff 类型，假设是个静态提升的节点，那么他的 `patchFlag` 会是 `HOISTED`，意味着这是个静态内容不需要 diff，属于是对症下药，只对动态内容进行 diff，静态内容不进行 diff，这样就优化了 diff 性能