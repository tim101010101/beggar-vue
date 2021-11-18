# 编译模块5: directiveTransforms 实现

> 源码位置:
> vue-next/packages/compile-core/src/transforms/vOn.ts
> vue-next/packages/compile-core/src/transforms/vBind.ts

到这里 transform 模块其实已经基本实现了，不过还需要专门再处理一下 `v-on` 和 `v-bind`，也以此作为一个简单的例子看看指令编译都会做些什么

## 解释一下

`directiveTransforms` 也是一类 `transform plugin` 转换插件，其中包括一些 `transformOn`、`transformBind` 之类的指令处理函数，本文就实现这两个，指令处理做的事情都比较琐碎，简单概括一下就是

+ 针对不同的指令进行不同的处理
  + v-on 需要驼峰化事件监听、处理事件监听缓存、应用拓展插件等
  + v-bind 需要处理一些前置修饰符并进行一些容错处理
+ 将指令内容包装成 `JS_PROPERTY` 对象返回

## 写一下 transformOn

### 两个工具函数

这里来写两个工具函数

#### capitalize

上面说到要驼峰化事件监听，当然得有这么一个工具函数了

```js
function camelize(str) {
  return str.replace(
    /-(\w)/g, 
    (neverUse, c) => (c ? c.toUpperCase() : '')
  );
}
```

这里的一连串可能看起来有点懵，`replace` 第一个参数可以接收一个正则表达式，而第二个参数接收一个回调函数，回调函数的参数非常像 `RegExp.exec()` 的返回结果，第一个参数是匹配到的子串，第二个参数开始是捕捉组的内容，以下是一个例子

```js
const str = 'yes-this-is-my-handler';
// 上面这个例子中
// nerverUse 是 ['-t', '-i', '-m', '-h']
// c 是 ['t', 'i', 'm', 'h']
camelize(str); // yesThisIsMyHandler
```

#### toHandlerKey

这里是一个将 `xxx-xx` 转化为 `onxxxXx` 的工具函数，就非常简单

```js
const toHandlerKey = str => (str ? `on${capitalize(str)}` : '')
```

### transformOn

`transformOn` 中要做的事情很繁琐，但我们的 `transformOn` 要做的事情非常简单，只需要驼峰化事件监听，然后包装成 `JS_PROPERTY` 类型的对象返回即可

```js
const transformOn = dir => {
  const { arg } = dir;

  // 驼峰化
  let eventName;
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      const rawName = arg.content;
      eventName = createSimpleExpression(toHandlerKey(camelize(rawName)), true);
    }
    // 源码在这里将动态的事件名处理成组合表达式
  } else {
    eventName = arg;
  }

  // 处理表达式
  let exp = dir.exp;
  if (exp && !exp.content.trim()) {
    exp = undefined;
  }
  // 源码在这里会处理事件缓存
  // 源码在这里会处理外部插件 extended compiler augmentor

  // 包装并返回 JS_PROPERTY 节点
  let ret = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression('() => {}', false)
      ),
    ],
  };
  return ret;
};
```

## 写一下 transformBind

`transformBind` 要做的事情简单很多，容错处理、增加前缀、包装节点，直接看代码吧

```js
const transformBind = dir => {
  const { exp, modifiers } = dir;
  const arg = dir.arg;

  // 容错处理，如果为空则输出一个空字符串
  if (arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    arg.children.unshift('(');
    arg.children.push(') || ""');
  } else if (!arg.isStatic) {
    arg.content = `${arg.content} || ""`;
  }

  // prop 增加 "." 前缀
  // attr 增加 "^" 前缀
  if (modifiers.includes('prop')) {
    injectPrefix(arg, '.');
  }
  if (modifiers.includes('attr')) {
    injectPrefix(arg, '^');
  }

  // 包装并返回 JS_PROPERTY 节点
  if (
    !exp ||
    (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
  ) {
    return {
      props: [createObjectProperty(arg, createSimpleExpression('', true))],
    };
  }

  return {
    props: [createObjectProperty(arg, exp)],
  };
};

// 前缀处理函数
const injectPrefix = (arg, prefix) => {
  if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    if (arg.isStatic) {
      arg.content = prefix + arg.content;
    } else {
      arg.content = `\`${prefix}\${${arg.content}}\``;
    }
  } else {
    arg.children.unshift(`'${prefix}' + (`);
    arg.children.push(`)`);
  }
};
```

## 总结

以上就是 `transformOn` 和 `transformBind` 的实现，这两者都属于 `directiveTransforms`，在前面 `transformElement` 时调用，而此处需要注意的是，这几个指令处理插件只会处理有 `args` 的指令，因为没有 `args` 的指令在 `transformElement` 里面已经处理了
单从这两个指令处理插件来看，其实他们和 `nodeTransforms` 很像，都是做一些处理，然后根据结构进行包装，便于 generate，而实际上也是如此，其他的指令比如 `v-model`、`v-for` 之类的都会进行包装，其余指令由于笔者水平以及精力有限就先不做实现了