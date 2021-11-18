# 编译模块3: parse 实现

> 源码位置:
> vue-next/packages/compile-core/src/parse.ts

终于是可以开始写了，实际上，因为偷了大懒，`parse` 并不复杂，也不会很难理解，个人感觉更多的还是流程控制

## 分析一下

**模板字符串实际上是一个长长的字符串，这意味着我们没法直接从结构上分析出标签的嵌套情况**，这一点非常关键，因为嵌套标签，嵌套内容是非常非常常见的操作，因此在处理上需要注意，不过转念一想，其实需要递归调用 `parseChildren` 的只有一种情况，也就是标签中嵌套标签的情况

其实这里本来会是一张流程图，但是发现我画不出来，害，口述一下

+ 元素节点: 元素节点的解析是最为复杂的，因为其中需要解析标签节点、属性/指令节点和内容节点，且需要递归地挂载子节点
+ 文本节点: 文本节点的解析十分简单，拿到文本内容封装成一个节点返回就行了
+ 插值表达式节点: 插值表达式其实和文本节点很像，也是非常简单，拿到其中的表达式/内容封装成节点返回即可

## 写一下

上文我们已经完成了很多准备工作，本文实现起来是非常轻松的，直接从 `parseChildren` 开始

### parseChildren

这一步才是编译真正的开始，在这里面我们需要编译整个模板字符串，将一个个标签、属性、指令、内容、插值表达式识别出来，并封装成节点存入一个数组返回
前文也提到，由于代码会产生大量的嵌套域，必然需要使用循环递归的方式来控制流程，实现如下

```js
const parseChildren = context => {
    const nodes = [];

    while (!isEnd(context)) {
        const s = context.source;

        let node;

        // 此处做了简化
        // 源码这里有一大串的 if else if else
        // 但是很多都是处理比如
        // '<!--' '<!DOCTYPE' '<![CDATA['
        // 还有很多容错处理

        // 以 < 开头则是元素
        if (s[0] === '<') {
            node = parseElement(context);
        }

        // 以 {{ 开头则是插值表达式
        else if (startsWith(s, '{{')) {
            node = parseInterpolation(context);
        }

        // 否则就是文本节点
        else {
            node = parseText(context);
        }

        // 源码中是这样的
        // 如果以上都不满足，就 parseText
        // if (!node) {
        //     node = parseText(context);
        // }

        // 源码中写了个 pushNode 方法来控制，这里直接写出来了
        nodes.push(node);
    }
    return nodes;
}
```

这里的代码其实很好理解，在字符串解析完之前循环读取，并根据开头的第一个字符来判断接下来这个节点的类型，调用相应的方法解析之后 push 到数组中即可

### 解析元素节点

我们字符串中第一个节点往往都是元素节点，在这里我们需要做的事情就是解析出节点内容，包括标签名、是否自闭合、属性、指令等，并且挂载在一个 `element` 节点身上返回

#### parseElement

不考虑嵌套的情况，一个简单的标签长这样

```html
<div class="a" v-bind:b="c">parse {{ element }}</div>
```

我们可以写一个 `parseTag` 来解析标签名，并返回一个 `ELEMENT` 类型的节点，而这个 `parseTag` 里面也得解析标签的属性和指令，那么就再来一个 `parseAttributes` 给 `parseTag` 内部调用，用来解析属性/指令并挂载到要返回的 `ELEMENT` 节点上，文本内容很好处理，只要递归调用 `parseChildren` 即可

可是这里有一个问题，我们需要处理闭合标签 `</div>` 么？

其实处理是肯定要处理的，因为如果不处理的话，`context.source` 开头就是一个 `</div>`，这意味着后面的解析就不会再继续了，因此我们必须得处理，但不用解析，因为闭合标签没必要单独作为一个节点存在，只需要把他分割掉就可以了

那么自闭合标签又该怎么处理呢，比如 `<br />`？

其实上文有提到过定义一个 `isSelfClosing` 来表示这个节点是否是自闭合标签，而自闭合标签不会有子节点，也不会有闭合标签，那么只要加一层判断即可

实现如下

```js
// 解析元素节点
const parseElement = context => {
    const element = parseTag(context);

    // 如果是自闭合标签就不用解析子节点和闭合标签了
    // 但是 <br /> 合法，<br> 也是合法的
    // 因此用 isVoidTag 判断一下
    if (element.isSelfClosing || isVoidTag(element.tag)) {
        return element;
    }

    element.children = parseChildren(context);

    // 只是要分割掉闭合标签 </div>，因此不用接收
    parseTag(context);

    return element;
}
```

#### parseTag

接下来就是解析元素节点的重点了，`parseTag` 里面需要做的事情上面有分析过，这里简单概括一下，其实就是要返回一个 `ELEMENT` 类型的节点，并把需要的属性挂载，而属性挂载的话后面再说，这里流程其实很好理解，一看就懂

```js
// 解析标签内容
// 进来时长这样
// <div class="a" v-bind:b="c">parse {{ element }}</div>
const parseTag = context => {
    // 这个正则下面解释
    const tagReg = /^<\/?([a-z][^\t\r\n\f />]*)/i;

    // 这时的 match 是 ['<div', 'div']
    const match = tagReg.exec(context.source);
    const tag = match[1];

    advanceBy(context, match[0].length);
    advanceSpaces(context);

    // 此时 context.source
    // class="a" v-bind:b="c">parse {{ element }}</div>

    // parseAttributes 下面再实现
    const { props, directives } = parseAttributes(context);

    // 此时 context.source 会变成
    // >parse {{ element }}</div>

    const isSelfClosing = startsWith(context.source, '/>');

    // 分割掉 "/>" 或 ">"
    advanceBy(context, isSelfClosing ? 2 : 1);

    // 判断是组件还是原生元素
    const tagType = isHTMLTag(tag)
        ? ElementTypes.ELEMENT
        : ElementTypes.COMPONENT;

    return {
        type: NodeTypes.ELEMENT,
        tag,
        tagType,
        props,
        directives,
        isSelfClosing,
        children: [],
    };
}
```

此处解释一下上面那个用来匹配标签名的正则 `/^<\/?([a-z][^\t\r\n\f />]*)/i`，这里使用了一个捕捉组来缓存匹配到的内容，就是 `([a-z][^\t\r\n\f />]*)`，这里的意思是匹配小写字母开头并且不是空白字符、`/`、`>` 的任意多个字符，并把这里匹配到的内容缓存下来，后面再通过 `exec` 来获取捕捉组内容，因此 `match` 数组的第一项就是匹配到的内容 `<div`，而第二项就是捕捉组缓存的内容 `div`，也就是标签名了

#### parseAttributes

上面也透露的很明显了，`parseAttributes` 会返回一个包含 `props` 和 `directives` 两个属性的对象，并且会把属性/指令部分全部分割掉解析出其中的数据，以下直接开始写

```js
// 解析所有属性
// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttributes = context => {
    const props = [];
    const directives = [];

    // 循环解析
    // 遇到 ">" 或者 "/>" 或者 context.source 为空字符串了才停止解析
    while (
        context.source.length > 0 &&
        !startsWith(context.source, '>') &&
        !startsWith(context.source, '/>')
    ) {
        // 调用前
        // class="a" v-bind:b="c">parse {{ element }}</div>
        // parseAttributes 下面再实现
        const attr = parseAttribute(context);
        // 调用后
        // v-bind:b="c">parse {{ element }}</div>

        if (attr.type === NodeTypes.DIRECTIVE) {
            directives.push(attr);
        } else {
            props.push(attr);
        }
    }

    return { props, directives };
}
```

属性可能不止一个、指令也可能不止一个，因此循环进行解析，再根据解析出来的节点 `attr` 的 `type` 属性来判断属于指令还是属性

#### parseAttribute

根据上一步可知，`parseAttribute` 会解析形如 `a="b"` 的单个属性并封装成节点返回，不过这里有一个需要注意的，要如何区分指令和属性呢？

属性和指令最明显的区别就是指令名称全部都以 `v-` 或者一些特殊符号开头，如 `:`、`@`、`#` 等，因此只需要对这个属性的名称进行处理即可，因此就出现了一个先后顺序的问题，如下

```js
// 解析单个属性
// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttribute = context => {
    // 匹配属性名的正则
    const namesReg = /^[^\t\r\n\f />][^\t\r\n\f />=]*/;

    // match 这时是 ["class"]
    const match = namesReg.exec(context.source);
    const name = match[0];

    // 分割掉属性名
    advanceBy(context, name.length);
    advanceSpaces(context);
    // context.source 这时是
    // ="a" v-bind:b="c">parse {{ element }}</div>

    let value;
    if (startsWith(context.source, '=')) {
        // 源码里是连着前面的空格一起匹配的
        // 但是这里已经在前面分割了空格，因此直接判断第一个字符是 = 即可
        // 源码长这样
        // if (/^[\t\r\n\f ]*=/.test(context.source)) {
        // advanceSpaces(context);

        advanceBy(context, 1);
        advanceSpaces(context);

        // 解析属性值
        // 后面再实现
        // 调用前
        // "a" v-bind:b="c">parse {{ element }}</div>
        value = parseAttributeValue(context);
        advanceSpaces(context);
        // 调用后
        // v-bind:b="c">parse {{ element }}</div>
    }

    // TODO

    // Attribute
    return {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
            type: NodeTypes.TEXT,
            content: value,
        },
    };
}
```

可以看到上面代码中我们解析了属性，分别获得属性名和属性值并将他们从源代码中分割掉即可，那么我们在取得属性名属性值之后来处理指令就会变得非常简单，在我预留的 `TODO` 位置开始写即可

```js
// 解析单个属性
const parseAttribute = context => {
    // 上面获取了属性名 name 和属性值 value
    // ......

    if (/^(:|@|v-[A-Za-z0-9-])/.test(name)) {
        let dirName, argContent;

        // <div :a="b" />
        if (startsWith(name, ':')) {
            dirName = 'bind';
            argContent = name.slice(1);
        }

        // <div @click="a" />
        else if (startsWith(name, '@')) {
            dirName = 'on';
            argContent = name.slice(1);
        }

        // <div v-bind:a="b" />
        else if (startsWith(name, 'v-')) {
            [dirName, argContent] = name.slice(2).split(':');
        }

        // 返回指令节点
        return {
            type: NodeTypes.DIRECTIVE,
            name: dirName,
            exp: value && {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: value,
                isStatic: false,
            },
            arg: argContent && {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: argContent,
                isStatic: true,
            },
        };
    }

    // ......
}
```

这里可以看到，开头的正则表达式 `/^(:|@|v-[A-Za-z0-9-])/` 会匹配 `:`、`@` 或者 `v-` 开头的内容，匹配到了则认为是指令，之后再根据开头的字符进行判断，按照不同的类型获取 `dirName` 和 `argContent`，之后直接返回一个 `DIRECTIVE` 类型的指令节点

#### parseAttributeValue

`parseElement` 只剩下一个 `parseAttributeValue` 了，这个只需要获取属性值即可，如下

```js
// 获取属性值
// 进来时是这样的
// "a" v-bind:b="c">parse {{ element }}</div>
const parseAttributeValue = context => {
    // 获取引号的第一部分
    const quote = context.source[0];

    // 分割掉引号的第一部分
    // a" v-bind:b="c">parse {{ element }}</div>
    advanceBy(context, 1);

    // 找到匹配的结尾引号
    const endIndex = context.source.indexOf(quote);

    // 获取属性值
    const content = parseTextData(context, endIndex);

    // 分割掉结尾引号前面的部分
    advanceBy(context, 1);

    return content;
}
```

这里的流程比较清晰，都在注释里，就不多做赘述了，目前我们已经完成了 `parseElement` 的流程，接着还剩下解析文本节点 `parseText` 和解析插值表达式节点 `parseInterpolation`

### 解析文本节点

如果前面的元素节点解析都看懂了，那么解析文本节点应该也能有思路了，先来看看什么情况下会进入 `parseText`

```html
parse {{ element }}</div>
parse</div>
```

而我们需要的只是 `parse` 这个字符串，也就意味这我们只要解析到插值表达式或者闭合标签就可以了，那么这里就可以用两个 `endToken` 来标识这次解析的终点，分别是 `<` 和 `{{`，意思就是只要看到这两个东西中任意一个就停止解析，并且应该以最靠前的一个为准，那么实现起来就会是下面这样

```js
// 解析文本节点
// 进来时是这样的
// parse {{ element }}</div>
const parseText = context => {
    // 两个结束标识
    const endTokens = ['<', '{{'];
    let endIndex = context.source.length;

    for (let i = 0; i < endTokens.length; i++) {
        // 找结束标识
        const index = context.source.indexOf(endTokens[i]);

        // 找最靠前的一个结束标识
        if (index !== -1 && index < endIndex) {
            endIndex = index;
        }
    }

    // 把结束标识前的所有内容分割出来
    const content = parseTextData(context, endIndex);

    return {
        type: NodeTypes.TEXT,
        content,
    };
}
```

以上就完成了，关键点在于这个小细节，要找到最靠前的一个，也就是只取 `index` 的最小值赋给 `endIndex`，否则会有 bug

### 解析插值表达式

插值表达式的解析和 `parseAttributeValue` 很像，都是从形如 `"aba"` 的结构中取出 `"b"` ，直接开始写就可以了

```js
// 解析插值表达式
// 进来时是这样的
// {{ element }}</div>
function parseInterpolation(context) {
    const [open, close] = ['{{', '}}'];

    advanceBy(context, open.length);
    // 这时变成
    //  element }}</div>

    // 找 "}}" 的索引
    const closeIndex = context.source.indexOf(close, open.length);

    const content = parseTextData(context, closeIndex).trim();
    advanceBy(context, close.length);
    // 这时变成
    // </div>

    return {
        type: NodeTypes.INTERPOLATION,
        content: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: false,
            content,
        },
    };
}
```

## 总结

以上就基本完成了，`parse` 做的事情不难理解，就是不断的解析信息，解析完成就将这部分删掉，再解析，不过一上来看可能会懵，其实我个人不觉得看了这篇文章就能完全搞懂，可能在某一步思路断开看不出现在 `context.source` 长什么样了，所以**强烈推荐 copy 一下代码去 debug 一下**，监视 `context.source`，看看整个流程跑下来 `context.source` 是怎么变化的，就很清晰很一目了然了

由于希望尽量解释清楚 `context.source` 的变化，上面书写步骤写了很多注释，而且这部分代码一个函数调一个函数再调一个函数的套娃，因此行文的组织也不够严谨，以下直接给上这部分全部源码，真的 debug 一次就能全部看懂了

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
    const nodes = [];

    while (!isEnd(context)) {
        const s = context.source;
        let node;
        if (startsWith(s, '<')) {
            node = parseElement(context);
        } else if (startsWith(s, '{{')) {
            node = parseInterpolation(context);
        } else {
            node = parseText(context);
        }

        nodes.push(node);
    }
    return nodes;
}

const parseElement = context => {
    const element = parseTag(context);

    if (element.isSelfClosing || isVoidTag(element.tag)) return element;
    
    element.children = parseChildren(context);

    parseTag(context);

    return element;
}

const parseTag = context => {
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
    const tag = match[1];
    advanceBy(context, match[0].length);
    advanceSpaces(context);

    const { props, directives } = parseAttributes(context);

    const isSelfClosing = startsWith(context.source, '/>');
    advanceBy(context, isSelfClosing ? 2 : 1);

    const tagType = isHTMLTag(tag)
        ? ElementTypes.ELEMENT
        : ElementTypes.COMPONENT;

    return {
        type: NodeTypes.ELEMENT,
        tag,
        tagType,
        props,
        directives,
        isSelfClosing,
        children: [],
    };
}

const parseAttributes = context => {
    const props = [];
    const directives = [];

    while (
        context.source.length > 0 &&
        !startsWith(context.source, '>') &&
        !startsWith(context.source, '/>')
    ) {
        const attr = parseAttribute(context);
        if (attr.type === NodeTypes.DIRECTIVE) {
            directives.push(attr);
        } else {
            props.push(attr);
        }
    }

    return { props, directives };
}

const parseAttribute = context => {
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
    const name = match[0];
    advanceBy(context, name.length);
    advanceSpaces(context);

    let value;
    if (startsWith(context.source, '=')) {
        advanceBy(context, 1);
        advanceSpaces(context);

        value = parseAttributeValue(context);
        advanceSpaces(context);
    }

    if (/^(:|@|v-[A-Za-z0-9-])/.test(name)) {
        let dirName, argContent;
        if (startsWith(name, ':')) {
            dirName = 'bind';
            argContent = name.slice(1);
        } else if (startsWith(name, '@')) {
            dirName = 'on';
            argContent = name.slice(1);
        } else if (startsWith(name, 'v-')) {
            [dirName, argContent] = name.slice(2).split(':');
        }

        return {
            type: NodeTypes.DIRECTIVE,
            name: dirName,
            exp: value && {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: value,
                isStatic: false,
            },
            arg: argContent && {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: argContent,
                isStatic: true,
            },
        };
    }

    return {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
            type: NodeTypes.TEXT,
            content: value,
        },
    };
}


const parseAttributeValue = context => {
    const quote = context.source[0];
    advanceBy(context, 1);

    const endIndex = context.source.indexOf(quote);

    const content = parseTextData(context, endIndex);

    advanceBy(context, 1);

    return content;
}

const parseText = context => {
    const endTokens = ['<', '{{'];
    let endIndex = context.source.length;

    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i]);
        if (index !== -1 && index < endIndex) {
            endIndex = index;
        }
    }

    const content = parseTextData(context, endIndex);

    return {
        type: NodeTypes.TEXT,
        content,
    };
}

function parseInterpolation(context) {
    const [open, close] = ['{{', '}}'];
    advanceBy(context, open.length);

    const closeIndex = context.source.indexOf(close, open.length);

    const content = parseTextData(context, closeIndex).trim();
    advanceBy(context, close.length);

    return {
        type: NodeTypes.INTERPOLATION,
        content: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: false,
            content,
        },
    };
}

// utils
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