import { reactive, effect, proxyRefs } from '../reactivity';
import { normalizeVNode } from './vnode';
import { patch } from './render';
import { queueJob } from './scheduler';
import { baseCompile } from '../compiler';

export function mountComponent(vnode, container, anchor) {
  // 组件的 type 是一个对象
  // 里面有 props、render、setup等
  const { type: Component } = vnode;

  const instance = (vnode.component = {
    props: null,
    attrs: null,
    setupState: null,
    ctx: null,
    subTree: null,
    isMounted: false,
    update: null,
    next: null
  });

  updateProps(instance, vnode);

  const { setup } = Component;
  if (setup) {
    // 这里偷懒了，其实 setupContext 还有 slots 和 emits
    const setupContext = createSetupContext(instance);
    const setupResult = setup(instance.props, setupContext);
    // const setupResult = setup.call(instance, instance.props, setupContext);

    instance.setupState = setupResult;

    //! 此处有问题
    // 源码中通过 proxyRefs 代理 setup 函数返回的对象
    // 意味着在 render 里面不需要通过 .value 的方式取值
    // 但是不知道是哪里的问题
    // 没法实现
    // handleSetupResult(instance, setupResult);
  }

  instance.ctx = {
    ...instance.props,
    ...instance.setupState
  };

  if (!Component.render && Component.template) {
    let { template } = Component;
    if (template[0] === '#') {
      const el = document.querySelector(template);
      template = el ? el.innerHTML : '';
    }
    const { code } = baseCompile(template);
    Component.render = new Function('ctx', code);
  }

  instance.update = effect(() => {
    if (!instance.isMounted) {
      const subTree = (instance.subTree = normalizeVNode(
        Component.render(instance.ctx)
      ));
      inheritAttrs(instance, subTree);
      patch(null, subTree, container, anchor);
      vnode.el = subTree.el;
      instance.isMounted = true;
    } else {
      if (instance.next) {
        vnode = instance.next;
        instance.next = null;
        updateProps(instance, vnode);

        // 更新 ctx
        // 源码中是 proxyRef, 会主动更新
        // 而这里偷懒了, 因此要手动更新
        instance.ctx = {
          ...instance.props,
          ...instance.setupState
        };
      }

      const prev = instance.subTree;
      const subTree = (instance.subTree = normalizeVNode(
        Component.render(instance.ctx)
      ));

      inheritAttrs(instance, subTree);
      patch(prev, subTree, container, anchor);
      vnode.el = subTree.el;
    }
  }, queueJob);
}

// eslint-disable-next-line no-unused-vars
const handleSetupResult = (instance, setupResult) => {
  // 这里源码进行了其他的操作
  // 比如是个方法
  // 就认为是 render 逻辑，绑定到 render 上
  if (typeof setupResult === 'object') {
    instance.setupState = proxyRefs(setupResult);
  }
};

// slot 和 emit 没实现
function updateProps(instance, vnode) {
  // 解构出组件类型和属性
  // 其实不是组件类型 应该说是组件配置对象
  const { type: Component, props: vnodeProps } = vnode;

  const props = (instance.props = {});
  const attrs = (instance.attrs = {});

  for (const key in vnodeProps) {
    // 如果 props 中存在指定属性
    // 即声明接收的话
    // 就把该属性添加到 props 下
    if (Component.props && Component.props.includes(key)) {
      props[key] = vnodeProps[key];
    }

    // 如果没声明接收
    // 就添加到 attrs 下
    else {
      attrs[key] = vnodeProps[key];
    }
  }

  instance.props = reactive(instance.props);
}

// 实现 attribute 继承
// instance 是组件实例
// subTree 是组件的 VNode
function inheritAttrs(instance, subTree) {
  const { attrs } = instance;
  const { props } = subTree;

  if (attrs) {
    subTree.props = {
      ...props,
      ...attrs
    };
  }
}

// 偷懒了，还有 slots 和 emit
function createSetupContext(instance) {
  return {
    attrs: instance.attrs
  };
}
