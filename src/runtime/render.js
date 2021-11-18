import { ShapeFlags } from '../shared';
import { patchProps } from './patchProps';
import { mountComponent } from './component';

export const render = (vnode, container) => {
  const prevVNode = container._vnode;

  if (vnode) {
    patch(prevVNode, vnode, container);
  } else {
    prevVNode && unmount(prevVNode);
  }

  container._vnode = vnode;
};

// process
const processTextNode = (n1, n2, container) => {
  if (n1) {
    patchTextNode(n1, n2);
  } else {
    mountTextNode(n2, container);
  }
};

const processElement = (n1, n2, container) => {
  if (n1) {
    patchElement(n1, n2);
  } else {
    mountElement(n2, container);
  }
};

const processComponent = (n1, n2, container) => {
  if (n1) {
    // 源码中有 shouldUpdateComponent 判断是否该更新组件
    // 这里偷懒了，每次都更新
    updateComponent(n1, n2);
  } else {
    mountComponent(n2, container);
  }
};

// patch
export const patch = (n1, n2, container) => {
  if (n1 && n1.type !== n2.type) {
    unmount(n1);
    n1 = null;
  }

  const { shapeFlag } = n2;
  if (shapeFlag & ShapeFlags.TEXT) {
    processTextNode(n1, n2, container);
  } else if (shapeFlag & ShapeFlags.ELEMENT) {
    processElement(n1, n2, container);
  } else if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(n1, n2, container);
  }
};

const patchTextNode = (n1, n2) => {
  n2.el = n1.el;
  n1.el.textContent = n2.children;
};

const patchElement = (n1, n2) => {
  n2.el = n1.el;
  patchProps(n1.props, n2.props, n2.el);
  patchChildren(n1, n2, n2.el);
};

const patchChildren = (n1, n2, container) => {
  const { shapeFlag: prevShapeFlag, children: prevChildren } = n1;
  const { shapeFlag: nextShapeFlag, children: nextChildren } = n2;

  if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = nextChildren;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      container.textContent = '';
      mountChildren(nextChildren, container);
    } else {
      container.textContent = '';
    }
  } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      unmountChildren(prevChildren);
      container.textContent = nextChildren;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (n1[0].key && n2[0].key) {
        patchKeyedChildren(n1, n2, container);
      } else {
        patchUnkeyedChildren(n1, n2, container);
      }
    } else {
      unmountChildren(prevChildren);
    }
  } else {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = nextChildren;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(nextChildren, container);
    }
  }
};

const patchUnkeyedChildren = (prev, next, container) => {
  const oldLength = prev.length;
  const newLength = next.length;
  const commomLength = Math.min(oldLength, newLength);

  for (let i = 0; i < commomLength; i++) {
    patch(prev[i], next[i], container);
  }

  if (oldLength > newLength) {
    unmountChildren(prev.slice(commomLength));
  } else if (oldLength < newLength) {
    mountChildren(next.slice(commomLength), container);
  }
};

// mount
const mountTextNode = (vnode, container) => {
  const textNode = document.createTextNode(vnode.children);
  container.appendChild(textNode);

  vnode.el = textNode;
};

const mountElement = (vnode, container) => {
  const { type, props, children, shapeFlag } = vnode;

  const el = document.createElement(type);

  patchProps(null, props, el);
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    mountTextNode(vnode, el);
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    mountChildren(children, el);
  }

  container.appendChild(el);
  vnode.el = el;
};

const mountChildren = (children, container) => {
  children.forEach((child) => {
    patch(null, child, container);
  });
};

const updateComponent = (n1, n2) => {
  n2.component = n1.component;
  n2.component.update();
};

// unmount
const unmount = (vnode) => {
  const { shapeFlag, el } = vnode;
  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode);
  } else {
    el.parentNode.removeChild(el);
  }
};

const unmountChildren = (children) => {
  children.forEach((child) => {
    unmount(child);
  });
};

const unmountComponent = (vnode) => {
  // 源码里没这么简单
  // 因为还要处理生命周期之类的
  // 但我偷懒了 :)
  unmount(vnode.component.subTree);
};

// diff
const patchKeyedChildren = (c1, c2, container) => {
  let i = 0;
  let e1 = c1.length - 1;
  let e2 = c2.length - 1;

  // --------------------- 预处理 ---------------------

  while (i <= e1 && i <= e2 && c1[i].key === c2[i].key) {
    patch(c1[i], c2[i], container);
    i++;
  }

  while (i <= e1 && i <= e2 && c1[e1].key === c2[e2].key) {
    patch(c1[e1], c2[e2], container);
    e1--;
    e2--;
  }

  // --------------------- 核心 diff ---------------------

  // a b c
  // a d b c
  if (i > e1 && i <= e2) {
    for (let j = i; j <= e2; j++) {
      patch(null, c2[j], container);
    }
  }

  // a b c
  // a c
  else if (i > e2 && i <= e1) {
    for (let j = i; j <= e1; j++) {
      unmount(c1[j]);
    }
  }

  // a b c d f e
  // a c d b g e
  else {
    const s1 = i;
    const s2 = i;

    // 初始化 key 到新子节点索引的映射
    // 可以以此判断是否有需要卸载的节点
    // key 未存在于这个 map 中则是需要卸载的节点
    const keyToNewIndexMap = new Map();
    for (let i = s2; i <= e2; i++) {
      keyToNewIndexMap.set(c2[i].key, i);
    }

    let patched = 0;
    let moved = false;
    let maxNewIndexSoFar = 0;
    const toBePatched = e2 - s2 + 1;

    // 初始化新子节点索引到旧子节点索引的映射
    // 映射的意思是
    // 各位上的索引对应新子节点的位置
    // 各位上的值是 此处新子节点对应的旧子节点的位置
    // 源码这里用 0 来初始化 newIndexToOldIndexMap
    const newIndexToOldIndexMap = new Array(toBePatched).fill(-1);

    for (let i = s1; i <= e1; i++) {
      const prevChild = c1[i];
      if (patched >= toBePatched) {
        unmount(prevChild);
        continue;
      }

      // 旧子节点对应的新子节点的索引
      let newIndex;

      // key 存在则取出对应的新子节点索引
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key);
      }

      // 不存在则遍历新子节点
      // 找到第一个 -1 项，并将其索引赋给 newIndex
      // 保持原有顺序
      else {
        for (let j = s2; j <= e2; j++) {
          if (newIndexToOldIndexMap[j - s2] === -1) {
            newIndex = j;
            break;
          }
        }
      }

      // 根据 newIndex 进行处理

      // 如果 newIndex 为 undefined
      // 则说明 keyToNewIndexMap 中没有该旧子节点
      // 该旧子节点需要被卸载
      if (newIndex === undefined) {
        unmount(prevChild);
      }

      // 如果 newIndex 有值
      // 则说明该旧子节点需要 patch
      else {
        // 给 newIndexToOldIndexMap 赋值
        // ? 源码为什么要赋值为 i + 1
        // 猜测
        // 源码中给 newIndexToOldIndexMap 初始化时使用 0
        // 因此可能是为了避免 i = 0 的情况，才全部加一
        // 而这个数组本质上服务于后面的移动步骤的
        // 因此全部加一或者减一没有影响
        newIndexToOldIndexMap[newIndex - s2] = i;

        // 如果呈现递增上升趋势，则不用移动位置
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex;
        } else {
          moved = true;
        }

        patch(prevChild, c2[newIndex], container);

        patched++;
      }
    }

    // --------------------- 移动 ---------------------

    const seq = getSequence(newIndexToOldIndexMap);
    let j = seq.length - 1;

    for (let i = newIndexToOldIndexMap.length - 1; i >= 0; i--) {
      const nextIndex = s2 + i;
      const nextChild = c2[nextIndex];

      if (newIndexToOldIndexMap[i] === -1) {
        patch(null, c1[i + s2], container);
      } else if (moved) {
        // ------------------
        // example
        // nums = [ 999, 1, 2, 3, 4, 5, 0, 999 ]
        // res =  [ 1, 2, 3, 4, 5, 7 ]
        // ------------------
        // 没有最大上升子序列
        // 或者
        // 当前的 i 不等于 seq 中最大的索引
        // 即当前新子节点不是最后一个
        // 或者说当前新子节点不该是最后一个
        if (j < 0 || i !== seq[j]) {
          // 源码抽离了一个 move 函数
          // move();
          nextChild.el || patch(null, nextChild, container);
          container.appendChild(nextChild.el);
        } else {
          j--;
        }
      }
    }
  }
};

const getSequence = (nums) => {
  const res = [nums[0]];
  const pos = [0];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === -1) {
      pos.push(-1);
      continue;
    }

    if (nums[i] > res[res.length - 1]) {
      res.push(nums[i]);
      pos.push(res.length - 1);
    } else {
      for (let j = 0; j < res.length; j++) {
        if (res[j] > nums[i]) {
          res[j] = nums[i];
          pos.push(j);
          break;
        }
      }
    }
  }

  let cur = res.length - 1;
  for (let i = pos.length - 1; i >= 0 && cur >= 0; i--) {
    if (pos[i] === -1) {
      continue;
    } else if (pos[i] === cur) {
      res[cur] = i;
      cur--;
    }
  }

  return res;
};
