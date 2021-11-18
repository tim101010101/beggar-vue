import { isBoolean } from '../utils';

export function patchProps(oldProps, newProps, el) {
  if (oldProps === newProps) {
    return;
  }

  oldProps = oldProps || {};
  newProps = newProps || {};

  // 移除旧属性
  for (const key in oldProps) {
    if (key === 'key') {
      continue;
    }

    if (newProps[key] == null) {
      patchDomProp(oldProps[key], null, key, el);
    }
  }

  // 添加属性
  for (const key in newProps) {
    if (key === 'key') {
      continue;
    }

    const next = newProps[key];
    const prev = oldProps[key];

    if (prev !== next) {
      patchDomProp(prev, next, key, el);
    }
  }
}

const eventReg = /^on[A-Z]/;
const propsReg = /[A-Z]|^(value|checked|selected|muted|disabled)$/;

function patchDomProp(prev, next, key, el) {
  switch (key) {
    // 设置类名
    case 'class':
      el.className = next || '';
      break;

    // 设置样式
    case 'style':
      if (next == null) {
        el.removeAttribute('style');
      } else {
        if (prev) {
          for (const styleName in prev) {
            if (next[styleName] == null) {
              el.style[styleName] = '';
            }
          }
        }

        for (const styleName in next) {
          el.style[styleName] = next[styleName];
        }
      }
      break;

    default:
      // 绑定事件
      if (eventReg.test(key)) {
        // 将 onClick 转化为 click
        const eventName = key.slice(2).toLowerCase();

        // 删除原有事件
        if (prev) {
          el.removeEventListener(eventName, prev);
        }

        // next 存在则进行注册
        if (next) {
          // 添加事件监听，value 为事件处理回调
          el.addEventListener(eventName, next);
        }
      }

      // 个别特殊属性
      else if (propsReg.test(key)) {
        // 特例处理 <input type="checkbox" checked />
        if (next === '' && isBoolean(el[key])) {
          // checked = true
          next = true;
        }
        el[key] = next;
      }

      // 为一般属性
      else {
        // 特例处理 { "custom": false }
        // 如果一个属性的值为 false 或者 null 或者 undefined 则将此属性移除
        if (next == null || next === false) {
          el.removeAttribute(key);
        } else {
          el.setAttribute(key, next);
        }
      }
      break;
  }
}
