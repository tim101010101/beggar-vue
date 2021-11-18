import { isString } from '../utils';

export const NodeTypes = {
  // AST
  ROOT: 'ROOT',
  ELEMENT: 'ELEMENT',
  TEXT: 'TEXT',
  SIMPLE_EXPRESSION: 'SIMPLE_EXPRESSION',
  INTERPOLATION: 'INTERPOLATION',
  ATTRIBUTE: 'ATTRIBUTE',
  DIRECTIVE: 'DIRECTIVE',

  //container
  TEXT_CALL: 'TEXT_CALL',
  COMPOUND_EXPRESSION: 'COMPOUND_EXPRESSION',

  // JS
  VNODE_CALL: 'VNODE_CALL',
  JS_PROPERTY: 'JS_PROPERTY',
  JS_CALL_EXPRESSION: 'JS_CALL_EXPRESSION',
  JS_ARRAY_EXPRESSION: 'JS_ARRAY_EXPRESSION',
  JS_OBJECT_EXPRESSION: 'JS_OBJECT_EXPRESSION'
};

export const ElementTypes = {
  ELEMENT: 'ELEMENT',
  COMPONENT: 'COMPONENT'
};

export function createVNodeCall(
  type,
  tag,
  props,
  children,
  patchFlag,
  dynamicProps,
  directives,
  isComponent
) {
  return {
    type,
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isComponent
  };
}

export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
    components: [],
    directives: [],
    codegenNode: undefined
  };
}

export function createSimpleExpression(content, isStatic = false) {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content,
    isStatic
  };
}

export function createObjectProperty(key, value) {
  return {
    type: NodeTypes.JS_PROPERTY,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value
  };
}

export function createCallExpression(args = []) {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    arguments: args
  };
}

export function createObjectExpression(properties) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties
  };
}
