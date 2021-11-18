import { h } from './vnode';
import { render } from './render';
import { isString } from '../utils';

export function createApp(rootComponent) {
  const app = {
    mount(rootContainer) {
      if (isString(rootContainer)) {
        rootContainer = document.querySelector(rootContainer);
      }
      if (!rootComponent.render && !rootComponent.template) {
        rootComponent.template = rootContainer.innerHTML;
      }
      rootContainer.innerHTML = '';

      render(h(rootComponent), rootContainer);
    }

    // 源码中还有 use、mixin 等
  };

  return app;
}
