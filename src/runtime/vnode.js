import { isArray, isNumber, isString, isObject } from '../utils';
import { ShapeFlags } from '../shared';

export const Text = Symbol('Text');

export function h(type, props, children) {
  let shapeFlag = 0;

  if (isString(type)) {
    shapeFlag = ShapeFlags.ELEMENT;
  } else if (type === Text) {
    shapeFlag = ShapeFlags.TEXT;
  } else {
    shapeFlag = ShapeFlags.COMPONENT;
  }

  if (isString(children) || isNumber(children)) {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    // 为了方便后续操作，将 number 转化为 string
    children = children.toString();
  } else if (isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  return {
    type,
    props,
    children,
    shapeFlag,
    el: null,
    key: props && props.key,
    component: null
  };
}

export function normalizeVNode(result) {
  if (isObject(result)) {
    return result;
  }

  return h(Text, null, result.toString());
}
