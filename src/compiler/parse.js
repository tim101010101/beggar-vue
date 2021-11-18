import { NodeTypes, ElementTypes, createRoot } from './ast';
import { isVoidTag, isHTMLTag } from '../utils';

const createParseContext = (content) => {
  return {
    source: content
    // 源码中还有很多
    // 比如
    // options,
    // column: 1,
    // line: 1,
    // offset: 0,
    // 但这里只用到了 source
  };
};

export const baseParse = (content) => {
  const context = createParseContext(content);
  return createRoot(parseChildren(context));
};

const parseChildren = (context) => {
  const nodes = [];

  while (!isEnd(context)) {
    const s = context.source;
    let node;

    // 此处做了简化
    // 源码这里有一大串的 if else if else
    // 但是很多都是处理比如
    // '<!--' '<!DOCTYPE' '<![CDATA['
    // 还有很多容错处理
    if (s[0] === '<') {
      node = parseElement(context);
    } else if (startsWith(s, '{{')) {
      node = parseInterpolation(context);
    } else {
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
};

const parseElement = (context) => {
  const element = parseTag(context);

  // 如果是自闭合标签就不用解析子节点和闭合标签了
  // 但是 <br /> 合法，<br> 也是合法的
  // 因此用 isVoidTag 判断一下
  if (element.isSelfClosing || isVoidTag(element.tag)) return element;

  element.children = parseChildren(context);
  // 只是要分割掉闭合标签 </div>，不用接收
  parseTag(context);

  return element;
};

// 进来时长这样
// <div class="a" v-bind:b="c">parse {{ element }}</div>
const parseTag = (context) => {
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
    children: []
  };
};

// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttributes = (context) => {
  const props = [];
  const directives = [];

  // 遇到 ">" 或者 "/>" 或者 context.source 为空字符串了才停止解析
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
};

// 进来时长这样
// class="a" v-bind:b="c">parse {{ element }}</div>
const parseAttribute = (context) => {
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
  const name = match[0];
  advanceBy(context, name.length);
  advanceSpaces(context);

  let value;
  if (startsWith(context.source, '=')) {
    // 源码里是连着前面的空格一起匹配的
    // 但是这里已经在前面分割了空格，因此直接判断第一个字符是 = 即可
    // 源码长这样
    // if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // advanceSpaces(context);

    advanceBy(context, 1);
    advanceSpaces(context);

    value = parseAttributeValue(context);
    advanceSpaces(context);
  }

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

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value,
        isStatic: false
      },
      arg: argContent && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: argContent,
        isStatic: true
      }
    };
  }

  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value
    }
  };
};

// 进来时是这样的
// "a" v-bind:b="c">parse {{ element }}</div>
const parseAttributeValue = (context) => {
  const quote = context.source[0];
  advanceBy(context, 1);

  const endIndex = context.source.indexOf(quote);
  const content = parseTextData(context, endIndex);
  advanceBy(context, 1);
  return content;
};

// 进来时是这样的
// parse {{ element }}</div>
const parseText = (context) => {
  const endTokens = ['<', '{{'];
  let endIndex = context.source.length;

  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i]);
    // 找最靠前的一个结束标识
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }

  const content = parseTextData(context, endIndex);

  return {
    type: NodeTypes.TEXT,
    content
  };
};

// 进来时是这样的
// {{ element }}</div>
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
      content
    }
  };
}

// utils
const advanceBy = (context, numberOfCharacters) => {
  const { source } = context;
  context.source = source.slice(numberOfCharacters);
};

const advanceSpaces = (context) => {
  const spacesReg = /^[\t\r\n\f ]+/;
  const match = spacesReg.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
};

const startsWith = (source, searchString) => {
  return source.startsWith(searchString);
};

const isEnd = (context) => {
  const s = context.source;
  return !s || startsWith(s, '</');
};

const parseTextData = (context, length) => {
  const rawText = context.source.slice(0, length);
  advanceBy(context, length);
  return rawText;
};
