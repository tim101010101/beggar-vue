import { isObject, isString } from '../utils';
import { NodeTypes } from './ast';

function createCodegenContext() {
  const context = {
    // state
    code: '',
    indentLevel: 0,

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
    }
  };
  function newline(n) {
    context.push('\n' + '  '.repeat(n));
  }
  return context;
}

export function generate(ast) {
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
    code: context.code
  };
}

function genNode(node, context) {
  if (isString(node)) {
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

function genProps(props, context) {
  const { push } = context;

  if (!props.length) {
    push('{}');
    return;
  }

  push('{ ');
  for (let i = 0; i < props.length; i++) {
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

function genPropKey(node, context) {
  const { push } = context;
  const { isStatic, content } = node;

  push(isStatic ? JSON.stringify(content) : content);
  push(': ');
}

function genPropValue(node, context) {
  const { push } = context;
  const { isStatic, content } = node;
  push(isStatic ? JSON.stringify(content.content) : content);
}

function genChildren(children, context) {
  const { push, indent } = context;

  push('[');
  indent();

  if (children.type === NodeTypes.COMPOUND_EXPRESSION) {
    genCompoundExpression(children, context);
  } else if (isObject(children) && children.type === NodeTypes.TEXT) {
    genNode(children, context);
  } else {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      genNode(child.codegenNode || child.children, context);
      push(', ');
    }
  }

  push(']');
}

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

function genCompoundExpression(node, context) {
  const { push } = context;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (isString(child)) {
      push(child);
    } else {
      genNode(child, context);
    }

    if (i !== node.children.length - 1) {
      push(', ');
    }
  }
}
