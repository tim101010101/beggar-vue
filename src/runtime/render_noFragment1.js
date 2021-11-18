import { ShapeFlags } from '../shared';
import { patchProps } from './patchProps';
import { mountComponent } from './component';

export function render(vnode, container) {
  const prevVNode = container._vnode;

  if (!vnode) {
    if (prevVNode) {
      unmount(prevVNode);
    }
  } else {
    patch(prevVNode, vnode, container);
  }

  container._vnode = vnode;
}

function unmount(vnode) {
  const { shapeFlag, el } = vnode;

  if (shapeFlag & ShapeFlags.COMPONENT) {
    unmountComponent(vnode);
  } else {
    el.parentNode.removeChild(el);
  }
}

export function patch(n1, n2, container) {
  if (n1 && !isSameVNode(n1, n2)) {
    unmount(n1);
    n1 = null;
  }

  const { shapeFlag } = n2;

  if (shapeFlag & ShapeFlags.COMPONENT) {
    processComponent(n1, n2, container);
  } else if (shapeFlag & ShapeFlags.TEXT) {
    processText(n1, n2, container);
  } else {
    processElement(n1, n2, container);
  }
}

function unmountComponent(vnode) {
  // 源码里没这么简单
  // 还要处理生命周期之类的
  // 但我偷懒了 :)
  unmount(vnode.component.subTree);
}

function processComponent(n1, n2, container) {
  if (n1) {
    // 组件被动更新
    // 源码中有 shouldUpdateComponent 判断是否该更新组件
    // 这里偷懒了, 每次都更新
    updateComponent(n1, n2);
  } else {
    mountComponent(n2, container);
  }
}

function updateComponent(n1, n2) {
  n2.component = n1.component;
  n2.component.next = n2;
  n2.component.update();
}

function isSameVNode(n1, n2) {
  return n1.type === n2.type;
}

function processText(n1, n2, container) {
  if (n1) {
    n2.el = n1.el;
    n1.el.textContent = n2.children;
  } else {
    mountTextNode(n2, container);
  }
}

function processElement(n1, n2, container) {
  if (n1) {
    patchElement(n1, n2);
  } else {
    mountElement(n2, container);
  }
}

function mountTextNode(vnode, container) {
  const textNode = document.createTextNode(vnode.children);
  container.appendChild(textNode);
  vnode.el = textNode;
}

function mountElement(vnode, container) {
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
}

function mountChildren(children, container) {
  for (const child of children) {
    patch(null, child, container);
  }
}

function patchElement(n1, n2) {
  n2.el = n1.el;
  patchProps(n1.props, n2.props, n2.el);
  patchChildren(n1, n2, n2.el);
}

function patchChildren(n1, n2, container) {
  const { shapeFlag: prevShapeFlag, children: c1 } = n1;
  const { shapeFlag: nextShapeFlag, children: c2 } = n2;

  // 9 种情况
  // 未进行合并
  if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = c2;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      container.textContent = '';
      mountChildren(c2, container);
    } else {
      container.textContent = '';
    }
  } else if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      unmountChildren(c1);
      container.textContent = c2;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      if (c1[0] && c1[0].key != null && c2[0] && c2[0].key != null) {
        patchKeyedChildren(c1, c2, container);
      } else {
        patchUnkeyedChildren(c1, c2, container);
      }
    } else {
      unmountChildren(c1);
    }
  } else {
    if (nextShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      container.textContent = c2;
    } else if (nextShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(c2, container);
    }
  }
}

function unmountChildren(children) {
  children.forEach((child) => {
    unmount(child);
  });
}

function patchUnkeyedChildren(c1, c2, container) {
  const oldLength = c1.length;
  const newLength = c2.length;
  const commonLength = Math.min(oldLength, newLength);

  // 处理公共部分
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container);
  }

  // 如果新长度短于老长度
  // 将多余部分卸载
  if (oldLength > newLength) {
    unmountChildren(c1.slice(commonLength));
  }
  // 如果新长度长于老长度
  // 挂载多出部分
  else if (oldLength < newLength) {
    mountChildren(c2.slice(commonLength), container);
  }
}

function patchKeyedChildren(c1, c2, container) {
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
      // 如果 c2[nextPos] 存在则将该节点作为 anchor
      // 否则用传入的 anchor

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

    // 保存 key 到新节点索引的映射关系
    const keyToNewIndexMap = new Map();
    for (let i = s2; i <= e2; i++) {
      const nextChild = c2[i];
      if (nextChild.key != null) {
        keyToNewIndexMap.set(nextChild.key, i);
      }
    }

    // patched 用来记录当前已经 patch 了多少个节点
    // 其实我觉得不用也行
    let patched = 0;
    const toBePatched = e2 - s2 + 1;
    let move = false;
    let maxNewIndexSoFar = 0;

    // 源码中这里是用 0 初始化的
    const newIndexToOldIndexMap = new Array(toBePatched).fill(-1);

    for (let i = s1; i <= e1; i++) {
      const prevChild = c1[i];
      if (patched >= toBePatched) {
        unmount(prevChild);
        continue;
      }

      // 当前旧子节点对应的新子节点的索引
      let newIndex;
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key);
      } else {
        for (let j = s2; j <= e2; j++) {
          if (newIndexToOldIndexMap[j - s2] === -1) {
            newIndex = j;
            break;
          }
        }
      }

      if (newIndex === undefined) {
        unmount(prevChild);
      } else {
        // 个人感觉此处 i + 1 的原因是
        // 源码中给 newIndexToOldIndexMap 初始化时使用 0
        // 因此可能是为了避免 i = 0 的情况，才全部加一
        // 而这个数组本质上服务于后面的移动步骤的
        // 因此全部加一或者减一没有影响
        newIndexToOldIndexMap[newIndex - s2] = i + 1;

        // 如果呈现递增上升趋势，则不用移动位置
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex;
        }
        // 否则需要移动
        else {
          move = true;
        }

        patch(prevChild, c2[newIndex], container);

        patched++;
      }
    }

    // --------------------- 移动 ---------------------

    // 进行移动
    // 采用最长上升子序列算法
    const seq = move ? getSequence(newIndexToOldIndexMap) : [];
    let j = seq.length - 1;

    // 从后往前遍历整个 newIndexToOldIndexMap
    // 这样就可以用最后一个 patch 的节点作为 anchor
    for (let i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i;
      const nextChild = c2[nextIndex];

      // 优先挂载新节点
      if (newIndexToOldIndexMap[i] === -1) {
        patch(null, nextChild, container);
      }

      // 如果需要移动，则判断当前节点是否在 LIS 上
      else if (move) {
        if (j < 0 || i !== seq[j]) {
          nextChild.el || patch(null, nextChild, container);
          container.appendChild(nextChild.el);
        }

        // 此处 j 需要手动迭代
        // 即当前节点在最大上升子序列内
        // 则 j 自减
        // 确保下次 j 的迭代与 i 的迭代同步
        // 由于此处遍历是从后往前遍历
        // 所匹配到的第一个在最大上升子序列内的节点的索引必定是 seq[j]
        // 因此此次匹配完
        // j 自减以匹配下一个在最大上升子序列内的节点的索引
        else {
          j--;
        }
      }
    }
  }
}

function getSequence(nums) {
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
}
