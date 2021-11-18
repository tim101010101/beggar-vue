# 编译模块7: compile 实现

> 源码位置:
> vue-next/packages/compile-core/src/compile.ts

最后的最后就是整个模块的主入口了，只要把之前的模块整合起来即可

## 写一下

这里直接给出代码，不过多赘述了

```js
// 插件预设
function getBaseTransformPreset() {
  return [
    [transformElement, transformText],
    {
      on: transformOn,
      bind: transformBind,
    },
  ];
}

function baseCompile(template, options = {}) {
  const ast = isString(template) ? baseParse(template, options) : template;

  // 获取插件预设
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();

  // 这里的 extend 实际上就是 Object.assign()
  transform(
    ast,
    extend({}, options, {
      nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {} // user transforms
      ),
    })
  );

  return generate(ast, extend({}, options));
}
```

## 用一下

这里 compile 模块完全写好了，那么该用到哪呢？
这个答案很明显，当然是用来编译组件模板，找到之前的 runtime 模块写过的 component 文件，现在就可以对其中实例上的 `render` 进行拓展
唯一要注意的就是一个挂载时机的问题，我们编译完成的代码是 `render` 函数，而其中需要用到上下文 `instance.ctx`，`render` 函数又需要用在 `instance.update` 组件挂载更新中，因此编译的时机应该是在上下文初始化完成后进行

```js
function mountComponent(vnode, container, anchor) {
  // TODO 初始化上下文

  if (!Component.render && Component.template) {
    let { template } = Component;
    
    if (template[0] === '#') {
      const el = document.querySelector(template);
      template = el ? el.innerHTML : '';
    }
    
    const { code } = baseCompile(template);
    Component.render = new Function('ctx', code);
  }

  // TODO 初始化挂载/更新函数
}
```

这里的思路就是优先获取组件内的 `template` 属性作为模板，否则就将 `mount()` 方法内指定的内容作为选择器，并把选中容器内的节点作为模板，再进行编译

这里用到了 `Function` 的构造函数，他长这样

```js
new Function ([arg1[, arg2[, ...argN]],] functionBody)
```

通过构造函数可以看出，我这里的做法是传入 `ctx` 和 `code`，前者作为函数参数，后者作为函数体内容，以此动态构建一个函数

## 跑一下

抛开其余那些入口函数之类的不管，书写如下代码

```html
<div id="app">
  <div>
    <p class="a">hello Beggar Vue</p>
    <div>counter: {{ counter.value }}</div>
    <button @click="add">click</button>
  </div>
</div>
<script>
  createApp({
    setup() {
      const counter = ref(0);
      const add = () => counter.value++;
      return {
        counter,
        add,
      };
    },
  }).mount('#app');
</script>
```

随便给 `p.a` 写个样式

```css
.a {
  font-size: large;
}
```

跑起来效果如下

![res](../images/res.png)

样式和指令之类的都能使用，暂时一切都在预料之中

## 总结

到目前为止就已经基本达到我的预期了，算是勉强能够算写完了，由于大量的偷懒，留下了茫茫多的 bug 和坑，但能跑就行，能跑就行...
