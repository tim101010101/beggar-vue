import { ShapeFlags } from '../shared';
import { isArray, isNumber, isObject, isString } from '../utils';

export const Text = Symbol('Text');
export const Fragment = Symbol('Fragment');

export function h(type, props, children) {
  let shapeFlag = 0;

  if (isString(type)) {
    shapeFlag = ShapeFlags.ELEMENT;
  } else if (type === Text) {
    shapeFlag = ShapeFlags.TEXT;
  } else if (type === Fragment) {
    shapeFlag = ShapeFlags.FRAGMENT;
  } else {
    shapeFlag = ShapeFlags.COMPONENT;
  }

  if (isString(children) || isNumber(children)) {
    shapeFlag |= ShapeFlags.TEXT_CHILDREN;
    children = children.toString();
  } else if (isArray(children)) {
    shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  return {
    type,
    props,
    children,
    shapeFlag,
    el: null, // 保存当前 dom 节点
    anchor: null, // 锚点控制插入位置，专为 fragment 服务
    key: props && props.key,
    component: null // 存储组件的实例
  };
}

// 处理不同的返回值形式
export function normalizeVNode(result) {
  if (isArray(result)) {
    return h(Fragment, null, result);
  }
  if (isObject(result)) {
    return result;
  }
  // string, number
  return h(Text, null, result.toString());
}
