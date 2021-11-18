# 编译模块6: codegen 实现

> 源码位置:
> vue-next/packages/compile-core/src/codegen.ts

上文实现了 transform，现在就进入整个 compile 最后的代码生成 codegen 环节了，个人感觉和前面的 transform 比起来，codegen 真的非常简单，源码位置在这里

## 说在开头

**我的实现和源码实现区别蛮大的**，因为源码中考虑了各种 helper、cache、hoist 之类的，而这些我都没实现。经过 transform 之后，AST 上的 `codegenNode` 节点上挂载的 `type` 属性就是这个节点对应的代码结构，源码就是根据这个来进行代码生成的，具体可以看看源码，这部分还是比较明了的

接着就是在开头一定要吐槽一下自己，前面 transform 模块基本完全按照源码的结构来写，生成的 `codegenNode` 结构是和源码基本一致的，但是正因如此，在 codegen 环节不得不处理的非常非常非常生硬，希望各位见谅，理解个意思就行了

## 分析一下

由于不需要考虑各种复杂的结构，我这里就简单划分为元素、属性、文本、组合表达式，分别进行代码生成即可
而生成节点的函数也就很自然的想到了之前在 runtime 模块暴露出的 `h` 函数，源码中使用的是 `createVNode`，不过这两者区别不大，都能创建 VNode，下面这个是 `h` 函数接收的参数

```js
function h(type, props, children) {
  // TODO
}
```

## 写一下

### createCodegenContext

我这里其实也不需要什么太多的上下文内容，但还是装模做样的稍微写一下，非常简单，如下

```js
function createCodegenContext() {
  const context = {
    // state
    code: '', // 目标代码
    indentLevel: 0, // 缩进等级

    // method
    push(code) {
      context.code += code;
    },
    indent() {
      newline(++context.indentLevel);
    },
    deindent(witoutNewLine = false) {
      if (witoutNewLine) {
        --context.indentLevel;
      } else {
        newline(--context.indentLevel);
      }
    },
    newline() {
      newline(context.indentLevel);
    },
  };
  function newline(n) {
    context.push('\n' + '  '.repeat(n));
  }
  return context;
}
```

### generate

`generate` 函数就是 codegen 的主入口了，在这里面我们需要获取上下文，然后生成代码的初步结构，内容由 `genNode` 递归生成，最后当然也得返回生成的代码

```js
function generate(ast) {
  const context = createCodegenContext();
  const { push, indent, deindent } = context;

  indent();
  push('with (ctx) {');
  indent();

  push('return ');
  if (ast.codegenNode) {
    genNode(ast.codegenNode, context);
  } else {
    push('null');
  }

  deindent();
  push('}');

  return {
    ast,
    code: context.code,
  };
}
```

### genNode

`genNode` 里面简单的用 `switch-case` 进行一个流程控制调用不同的方法即可

```js
function genNode(node, context) {
  // 如果是字符串就直接 push
  if (typeof node === 'string') {
    context.push(node);
    return;
  }

  switch (node.type) {
    case NodeTypes.ELEMENT:
      genElement(node, context);
      break;
    case NodeTypes.TEXT:
    case NodeTypes.INTERPOLATION:
      genTextData(node, context);
      break;
    case NodeTypes.COMPOUND_EXPRESSION:
      genCompoundExpression(node, context);
      break;
  }
}
```

### genElement

开头说到，创建 VNode 使用 `h` 函数，也就是说我们需要解析出 `tag`、`props`、`children` 作为参数传入，这里把生成属性和子节点的逻辑抽离了出去，`genElement` 如下

```js
function genElement(node, context) {
  const { push, deindent } = context;
  const { tag, children, props } = node;

  // tag
  push(`h(${tag}, `);

  // props
  if (props) {
    genProps(props.arguments[0].properties, context);
  } else {
    push('null, ');
  }

  // children
  if (children) {
    genChildren(children, context);
  } else {
    push('null');
  }

  deindent();
  push(')');
}
```

### genProps

`genProps` 要做的就是获取节点中的属性数据，并拼接成一个对象的样子 push 进目标代码，这里看一下在上面 `genElement` 中调用 `genProps` 传入的 `props.arguments[0].properties` 是个什么东西

```js
// <p class="a" @click="fn">hello {{ World }}</p>
[
    {
        "type": "JS_PROPERTY",
        "key": {
            "type": "SIMPLE_EXPRESSION",
            "content": "class",
            "isStatic": true
        },
        "value": {
            "type": "SIMPLE_EXPRESSION",
            "content": {
                "type": "TEXT",
                "content": "a"
            },
            "isStatic": true
        }
    },
    {
        "type": "JS_PROPERTY",
        "key": {
            "type": "SIMPLE_EXPRESSION",
            "content": "onClick",
            "isStatic": true,
            "isHandlerKey": true
        },
        "value": {
            "type": "SIMPLE_EXPRESSION",
            "content": "fn",
            "isStatic": false
        }
    }
]
```

那么我们就只需要按照这个结构来进行操作就可以了，如下

```js
function genProps(props, context) {
  const { push } = context;

  if (!props.length) {
    push('{}');
    return;
  }

  push('{ ');
  for (let i = 0; i < props.length; i++) {
    // 遍历每个 prop 对象，获取其中的 key 节点和 value 节点
    const prop = props[i];
    const key = prop ? prop.key : '';
    const value = prop ? prop.value : prop;

    if (key) {
      // key
      genPropKey(key, context);
      // value
      genPropValue(value, context);
    } else {
      // 如果 key 不存在就说明是一个 v-bind
      const { content, isStatic } = value;
      const contentStr = JSON.stringify(content);
      push(`${contentStr}: ${isStatic ? contentStr : content}`);
    }

    if (i < props.length - 1) {
      push(', ');
    }
  }
  push(' }, ');
}

// 生成键
function genPropKey(node, context) {
  const { push } = context;
  const { isStatic, content } = node;
  push(isStatic ? JSON.stringify(content) : content);
  push(': ');
}

// 生成值
function genPropValue(node, context) {
  const { push } = context;
  const { isStatic, content } = node;
  push(isStatic ? JSON.stringify(content.content) : content);
}
```

这里一定要再吐槽一下自己，这代码是真的丑.....

### genChildren

子节点是一个数组，只需要参考上面 `genProps` 的结构写就可以了，但是，由于我的 `transformText` 偷大懒没有生成 `codegenNode`，不得不单独进行处理，此外组合表达式 `COMPOUND_EXPRESSION` 也单独进行处理，其余正常递归 `genNode` 即可

```js
function genChildren(children, context) {
  const { push, indent } = context;

  push('[');
  indent();

  // 单独处理 COMPOUND_EXPRESSION
  if (children.type === NodeTypes.COMPOUND_EXPRESSION) {
    genCompoundExpression(children, context);
  } 
  
  // 单独处理 TEXT
  else if (isObject(children) && children.type === NodeTypes.TEXT) {
    genNode(children, context);
  } 
  
  // 其余节点直接递归
  else {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      genNode(child.codegenNode || child.children, context);
      push(', ');
    }
  }

  push(']');
}
```

### genTextData

插值表达式和文本节点都会由这个函数处理，因为他们两者在代码生成的结果上来说，唯一的区别就是子节点是否是字符串

```js
function genTextData(node, context) {
  const { push } = context;
  const { type, content } = node;

  // 如果是文本节点直接拿出 content
  // 如果是插值表达式需要拿出 content.content
  const textContent =
    type === NodeTypes.TEXT
      ? JSON.stringify(content)
      : NodeTypes.INTERPOLATION
      ? content.content
      : '';

  // 再偷个懒，默认文本节点没有属性
  push('h(Text, ');
  push('null, ');
  push(`${textContent})`);
}
```

### genCompoundExpression

组合表达式其实本质上就是一个节点，几个子节点可能是文本节点或者插值表达式节点，直接递归即可

```js
function genCompoundExpression(node, context) {
  const { push } = context;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (typeof child === 'string') {
      push(child);
    } else {
      genNode(child, context);
    }

    if (i !== node.children.length - 1) {
      push(', ');
    }
  }
}
```

## Q&A

Q: `h` 函数和 `createVNode` 的关系？
A: `h` 函数其实底层调用的就是 `createVNode`，属于是父子关系，而 `h` 函数中进行了一些容错处理之类的，比如你用 `h` 函数可以不传 `props` 直接传入 `children`，而这调 `createVNode` 会报错，但 `h` 进行了容错处理，因此没问题

Q: 你这里的实现和源码的实现主要区别在哪？
A: 处处都是区别，源码中的实现是完全以 `codegenNode` 的 `type` 属性作为指导来生成对应的结构，而节点的内容不是主要关注点，也就是说，我这里的实现是从功能为出发点，而源码是以结构为出发点，这就造成了一个很明显的区别，源码中根本没有什么 `genChildren`、`genProps`、`genPropKey`，源码中用的是 `genObjectExpression`、`genArrayExpression`、`genNodeListAsArray` 之类的，这样以结构为出发点抽离函数，就可以很大程度复用函数，操作起来也更为灵活，我写的这个确实是笨瓜代码

Q: 那你写的这个有什么用吗？
A: 跑通了我自己写的测试

## 总结

老实说我都不好意思总结，因为这里的实现实在是非常的糟糕，但是还是需要为自己辩解一下，为了尽量贴合源码的 transform 实现，生成了 `codegenNode`，生成了如果不用那多少觉得有点没意义，用了就只能这么生硬的实现，就当看着图一乐吧，以此**告诫大家不要偷懒**
