import { NodeTypes } from '../ast';
import { isText } from '../../utils';

export function transformText(node) {
  if (node.type === NodeTypes.ROOT || node.type === NodeTypes.ELEMENT) {
    return () => {
      const children = node.children;
      let currentContainer = undefined;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];

            // 找到了则进行合并
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  children: [child]
                };
              }

              // 合并相邻文本/插值表达式节点到 currentContainer 内
              currentContainer.children.push(next);
              children.splice(j, 1);
              j--;
            } else {
              currentContainer = undefined;
              break;
            }
          }
        }
      }
    };

    // 源码这里开始还会进行预转化
    // 就是将文本节点转换为 NodeTypes.JS_CALL_EXPRESSION 类型，
    // createTextVNode(text) 的调用
    // 源码中注释原话如下
    // pre-convert text nodes into createTextVNode(text) calls to avoid
    // runtime normalization.
  }
}
