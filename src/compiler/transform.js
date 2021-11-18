import { NodeTypes } from './ast';
import { isArray, isString } from '../utils';

export function createTransformContext(
  root,
  { nodeTransforms = [], directiveTransforms = {} }
) {
  const context = {
    // plugin
    nodeTransforms,
    directiveTransforms,

    // state
    root,
    parent: null,
    currentNode: root
  };

  return context;
}

export function transform(root, options) {
  const context = createTransformContext(root, options);
  traverseNode(root, context);
  createRootCodegen(root);
}

export function traverseNode(node, context) {
  context.currentNode = node;
  // 获取转换插件序列
  const { nodeTransforms } = context;
  const exitFns = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    // 获取退出函数
    const onExit = nodeTransforms[i](node, context);
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit);
      } else {
        exitFns.push(onExit);
      }
    }
    if (!context.currentNode) {
      return;
    } else {
      node = context.currentNode;
    }
  }

  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context);
      break;

    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT:
      // 这两兄弟不在这里处理
      break;
  }

  context.currentNode = node;

  // 执行退出函数
  // 从叶子节点往根节点执行
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
}

function traverseChildren(parent, context) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (isString(child)) continue;
    context.parent = parent;
    traverseNode(child, context);
  }
}

function createRootCodegen(root) {
  const { children } = root;
  if (children.length === 1) {
    const child = children[0];
    if (child.type === NodeTypes.ELEMENT && child.codegenNode) {
      const codegenNode = child.codegenNode;

      root.codegenNode = codegenNode;
    } else {
      root.codegenNode = child;
    }
  }

  // 源码中实现了多根节点的支持
  // else if (children.length > 1) {}
}
