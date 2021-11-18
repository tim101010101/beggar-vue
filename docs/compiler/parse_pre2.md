# 编译模块2: parse 准备

> 源码位置:
> vue-next/packages/compile-core/src/parse.ts

经过上文的铺垫，应该都对编译的过程以及 AST 的作用有了一定的认识，由于 `parse` 函数需要做的准备工作比较多，因此再分多一篇用来铺垫，下一篇就是正式实现了 

## 解释一下

直接开一手上帝视角，照着源码的思路来进行解释
`parse` 做的事情简单来说就是将模板字符串中有用的信息以各种方式提取出来，并形成一个个节点，最终构建成一棵 AST。

## 一些准备工作

以下是实现 `parse` 前需要做的准备，以及一些会遇到的问题

### 各节点属性

AST 节点需要一些属性来储存数据，方便后续步骤，那么我们需要哪些节点，这些节点又需要哪些属性呢

#### 根节点

AST 是一棵树，那么必然会需要一个根节点 `Root`，而所有的内容都应该挂载在根节点下作为子节点

```js
{
    type: 'ROOT',
    children: Array,
}
```

#### 元素节点

元素标签自然是得单独作为一个节点的，而元素节点上需要挂载的属性就比较多了，除了必须的 `type` 之外，还需要标签名和节点类型(原生/组件)，属性节点和指令指点也肯定是挂载在他身上的，接着还需要挂载子节点，除此之外，涉及到 `parse` 的流程控制，我们还需要知道这个标签是不是自闭合标签，那么这些属性都列举出来就是下面这样

```js
{
    type: 'ELEMENT',
    tag: String,
    tagType: 'COMPONENT' | 'ELEMENT',
    props: Array,
    directives: Array,
    isSelfClosing: Boolean,
    children: Array,
}
```

#### 属性节点

上面说到属性需要挂载在元素节点身上，那么属性也应该作为一个单独的节点，属性节点需要的就比较简单了，属性名和属性值即可，可是属性值也得作为一个节点，就需要再展开一下，如下

```js
{
    type: 'ATTRIBUTE',
    name: String,
    value: {
        type: 'TEXT',
        content: String,
    },
}
```

#### 指令节点

同上，我们也需要指令节点，而指令节点需要的属性就比较多了，因为指令可以接收表达式，而指令又存在指令参数，这些都是需要挂载的属性，此外，源码中的表达式和参数上定义了一个布尔类型属性 `isStatic` 来标识是否是静态的，这意味这后续优化可以根据这个属性来进行

```js
{
    type: 'DIRECTIVE',
    name: String,
    exp: {
        type: 'SIMPLE_EXPRESSION',
        content: String,
        isStatic: Boolean,
    },
    arg: {
        type: 'SIMPLE_EXPRESSION',
        content: String,
        isStatic: Boolean,
    },
}
```

#### 插值表达式节点

插值表达式内可以书写表达式，而且需要单独解析，也单独作为一个节点

```js
{
    type: 'INTERPOLATION',
    content: {
        type: 'SIMPLE_EXPRESSION',
        content: String,
        isStatic: Boolean,
    },
}
```

#### 文本节点

最后就是最没牌面最单纯的文本节点了，只需要保存内容就够了

```js
{
    type: 'TEXT',
    content: String,
}
```

以上就是我们需要的节点类型接口，不过真的省略了很多，比如源码中大部分节点还保存了一个 `loc` 属性，`location` 的缩写，用来保存这个节点在模板字符串中的具体位置，用在一些奇奇怪怪的地方，不过很自然的就省略了，能跑就行

### 如何判断节点类型

我们需要将 template 模板字符串编译成 AST，而每一个 AST 的节点都需要 `type` 这个必须属性，因为在进行后续步骤时我们需要根据 `type` 来生成不同的节点类型，为了方便使用，可以定义一个枚举，其中列出我们需要的类型，使用的时候就会非常方便，也不易出错，在源码中长这样

```ts
// vue-next/packages/compiler-core/ast.ts
// 25 行
export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  ATTRIBUTE,
  DIRECTIVE,
  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT
}
```

很长，这个懒是一定会偷的，接着我们还需要区分组件标签和原生标签，因此也很自然的需要枚举出来，在下面

```ts
// vue-next/packages/compiler-core/ast.ts
// 59 行
export const enum ElementTypes {
  ELEMENT,
  COMPONENT,
  SLOT,
  TEMPLATE
}
```

接下来就来定义我们自己的 `NodeTypes` 和 `ElementTypes`，如下

```js
const NodeTypes = {
    ROOT: 'ROOT',
    ELEMENT: 'ELEMENT',
    TEXT: 'TEXT',
    SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION',
    ATTRIBUTE: 'ATTRIBUTE',
    DIRECTIVE: 'DIRECTIVE',
    INTERPOLATION: 'INTERPOLATION',
};

const ElementTypes = {
    ELEMENT: 'ELEMENT',
    COMPONENT: 'COMPONENT',
};
```

### 如何区分组件和原生标签

那么上面说到区分组件和原生标签，其实在我看源码之前一直以为会有什么标识来进行区分，大家看 vue3 的解决方案

```js
// 所有 html 标准原生标签
// vue-next/packages/shared/domTagConfig.ts r6
const HTML_TAGS =
    'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
    'header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,' +
    'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
    'data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,' +
    'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
    'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
    'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
    'option,output,progress,select,textarea,details,dialog,menu,' +
    'summary,template,blockquote,iframe,tfoot';

// 一些自闭合标签，不写 "/>" 也可以的自闭合标签
// 即 <br/> 合法，<br> 也合法
// vue-next/packages/shared/domTagConfig.ts r30
const VOID_TAGS =
    'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';

// makeMap 函数下面需要解释一下
const makeMap = str => {
    const map = Object.create(null);
    const list = str.split(',');
    for (const l of list) {
        map[l] = true;
    }
    return val => !!map[val];
};

// vue-next/packages/shared/domTagConfig.ts r33
export const isHTMLTag = makeMap(HTML_TAGS);
// vue-next/packages/shared/domTagConfig.ts r35
export const isVoidTag = makeMap(VOID_TAGS);
```

此处需要介绍一下这个 `makeMap`，源码中穷举了所有的原生标签，并且穷举了自闭合标签，注释中有解释。

区分的关键在于这个 `makeMap` 函数，他会创建一个空对象 `map`，并在这个 `map` 上定义一个个属性，属性名是标签名，属性值是 `true`，那么这个 `map` 就成了一个字典(虽然说总觉得 js 中对象本身就是一种字典)，只需要判断一个标签名是否作为属性存在于 `map` 上，即可得知这个标签是否属于这一类别

前面的都很简单，其实要讲的是返回值的处理，`makeMap` 返回一个匿名函数，这是很典型的**函数柯里化**，通过一个闭包将 `map` 保存在匿名函数的上下文中，这意味着 `map` 在返回的时候已经被缓存了下来，这也是函数柯里化的一个特点，就是缓存机制
因此，在使用时传入不同类别的标签名字符串，再用一个变量接收返回的函数，之后只需要直接使用这个函数即可，不必再次执行 `makeMap`，如上面例子中的 `isHTMLTag`、`isVoidTag`

### createRoot

AST 既然是一棵树，那必然需要一个根节点，根节点也是一种特殊的类型，下面就实现一个函数来获取根节点

```js
const createRoot = children => {
    return {
        type: NodeTypes.ROOT,
        children,
    };
}
```

这里很好理解，开始解析之后，所有的节点内容都会挂载到根节点下，只要直接作为一个 `children` 属性挂载即可

### baseParse

在源码中，`parse` 其实叫做 `baseParse`，前面是简单起见就叫 `parse`，接下来就来简单写一下 `baseParse`，首先我们需要明确这里面要干什么。其实非常想当然的就是将传入的参数处理成 AST 并返回，而在这过程中我们会需要一个编译上下文 `parseContext`，里面保存模板字符串以及一些编译的配置，但是偷懒是肯定的，所以他长下面这样

```js
// vue-next/packages/compiler-core/src/parse.ts r104
const baseParse = content => {
    const context = createParseContext(content);

    return createRoot(parseChildren(context));
}

// 创建上下文
const createParseContext = content => {
    return {
        source: content, // 模板字符串
        // 源码中还有很多
        // 比如
        // options,
        // column: 1,
        // line: 1,
        // offset: 0,
        // 但这里只用到了 source
    };
}
```

这里需要说一下，源码中的 `parseContext` 里有一个 `options` 对象，可以来简单的看看他的接口

```ts
// vue-next/packages/compiler-core/src/options.ts r17
interface ParserOptions {
  /**
   * e.g. platform native elements, e.g. `<div>` for browsers
   */
  isNativeTag?: (tag: string) => boolean
  /**
   * e.g. native elements that can self-close, e.g. `<img>`, `<br>`, `<hr>`
   */
  isVoidTag?: (tag: string) => boolean
  /**
   * e.g. elements that should preserve whitespace inside, e.g. `<pre>`
   */
  isPreTag?: (tag: string) => boolean
  /**
   * Platform-specific built-in components e.g. `<Transition>`
   */
  isBuiltInComponent?: (tag: string) => symbol | void
  /**
   * Separate option for end users to extend the native elements list
   */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * Get tag namespace
   */
  getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace
  /**
   * Get text parsing mode for this element
   */
  getTextMode?: (
    node: ElementNode,
    parent: ElementNode | undefined
  ) => TextModes
  /**
   * @default ['{{', '}}']
   */
  delimiters?: [string, string]
  /**
   * Whitespace handling strategy
   */
  whitespace?: 'preserve' | 'condense'
  /**
   * Only needed for DOM compilers
   */
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  /**
   * Whether to keep comments in the templates AST.
   * This defaults to `true` in development and `false` in production builds.
   */
  comments?: boolean
}
```

`options` 里包括很多东西，比如说那个 `delimiters` 是插值表达式符号的定义，默认是 `['{{', '}}']`，`comments` 可以控制是否保留注释，开发环境会保留，生产环境会去除注释，还有一个 `whitespace` 空格处理策略。`options`是一个可配置对象，可以配置根据环境配置不同的编译上下文，不过我并没有实现

接着得稍微打断一下思维，先来写一些很重要的工具函数

### 一些工具函数

模板实际上是一个字符串，而操作字符串其实老实说挺麻烦的，因此有一些工具函数可以提前实现，磨刀不误砍柴工

#### advanceBy

既然是字符串操作，当然少不了分割字符串，以下是一个简单的分割字符串的函数

```js
const advanceBy = (context, numberOfCharacters) => {
    const { source } = context;
    context.source = source.slice(numberOfCharacters);
}
```

#### advanceSpaces

既然是字符串操作，还是要操作用户代码，当然少不了分割空格，需要用到一个很简单的正则表达式，大致流程就是，匹配空格、换行符、制表符等，匹配到了则全部删去

```js
const advanceSpaces = context => {
    const spacesReg = /^[\t\r\n\f ]+/;
    const match = spacesReg.exec(context.source);
    if (match) {
        advanceBy(context, match[0].length);
    }
}
```

#### startsWith

既然是字符串操作，也不必每次判断内容都用正则表达式，来写一个简单的小工具函数判断字符串是否以 xxx 开头

```js
const startsWith = (source, searchString) => {
    return source.startsWith(searchString);
}
```

有一说一这个函数源码里有，不过其实也不太必要，因为直接调 `.startsWith` 即可，不过 js 没有类型断言，每次都要输入整个 `.startsWith` 太麻烦了，也就直接把这个函数也带上了

#### isEnd

既然是字符串操作，当然需要判断一下字符串解析完了没，因为后面正式开始解析的时候，绝对是循环递归的形式解析的，就捎上这个函数，非常简单的
```js
const isEnd = context => {
    const s = context.source;
    return !s || startsWith(s, '</');
}
```

只需要判断字符串是否为空或者是否以 `</` 开头即可，如果是以 `</` 开头的话，就意味着这个标签的前半部分以及标签内容已经全部解析完了，没必要再解析闭合标签

#### parseTextData

既然是字符串操作，而且还是要提取内容，当然少不了分割文本数据

```js
const parseTextData = (context, length) => {
    const rawText = context.source.slice(0, length);
    advanceBy(context, length);
    return rawText;
}
```

只需要根据传入的 `length` 截取字符串作为内容返回，再将这个内容从原先的字符串中去掉即可

## 总结

本文是针对 `parse` 函数实现的一些前置铺垫，因为这些内容非常零散，放在正文中讲思维会一直被打断，所以不如干脆一点提前实现好
上面讲的很散，来看看我们目前都实现了什么

```js
// ast.js
const NodeTypes = {
    ROOT: 'ROOT',
    ELEMENT: 'ELEMENT',
    TEXT: 'TEXT',
    SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION',
    ATTRIBUTE: 'ATTRIBUTE',
    DIRECTIVE: 'DIRECTIVE',
    INTERPOLATION: 'INTERPOLATION',
};

const ElementTypes = {
    ELEMENT: 'ELEMENT',
    COMPONENT: 'COMPONENT',
};

const createRoot = children => {
    return {
        type: NodeTypes.ROOT,
        children,
    };
}
```

```js
// utils/index.js
// 前略
const HTML_TAGS =
    'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
    'header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,' +
    'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
    'data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,' +
    'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
    'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
    'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
    'option,output,progress,select,textarea,details,dialog,menu,' +
    'summary,template,blockquote,iframe,tfoot';

const VOID_TAGS =
    'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';

const makeMap = str => {
    // 这里也可以直接用一个 Map 也是可以的，只不过下面的处理要微调
    const map = Object.create(null);
    const list = str.split(',');
    for (const l of list) {
        map[l] = true;
    }
    return val => !!map[val];
};

const isHTMLTag = makeMap(HTML_TAGS);
const isVoidTag = makeMap(VOID_TAGS);
```

```js
// compiler/parse.js
const createParseContext = content => {
    return {
        source: content,
    };
}

const baseParse = content => {
    const context = createParseContext(content);
    return createRoot(parseChildren(context));
}

const parseChildren = context => {
    // TODO 下篇就写这个
}

// 一些工具函数
const advanceBy = (context, numberOfCharacters) => {
    const { source } = context;
    context.source = source.slice(numberOfCharacters);
}

const advanceSpaces = context => {
    const spacesReg = /^[\t\r\n\f ]+/;
    const match = spacesReg.exec(context.source);
    if (match) {
        advanceBy(context, match[0].length);
    }
}

const startsWith = (source, searchString) => {
    return source.startsWith(searchString);
}

const isEnd = context => {
    const s = context.source;
    return !s || startsWith(s, '</');
}

const parseTextData = (context, length) => {
    const rawText = context.source.slice(0, length);
    advanceBy(context, length);
    return rawText;
}
```