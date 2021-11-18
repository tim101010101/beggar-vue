import { reactive, effect, proxyRefs } from '../reactivity';
import { normalizeVNode } from './vnode';
import { patch } from './render';
import { queueJob } from './scheduler';
import { baseCompile } from '../compiler';

export function mountComponent(vnode, container, anchor) {
  // 组件的 type 是一个对象，里面有 props、render、setup等
  const { type: Component } = vnode;

  // attribute 是元素标签的属性
  // property 是元素对象的属性
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
    const setupContext = createSetupContext(instance);
    const setupResult = setup(instance.props, setupContext);
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

  console.log(Component.render);

  instance.update = effect(() => {
    // 首次 mount
    if (!instance.isMounted) {
      // 将这次的 subTree 保存在 instance 实例上
      // Component.render 返回一个 VNode 对象
      // 即 subTree
      const subTree = (instance.subTree = normalizeVNode(
        Component.render(instance.ctx)
      ));
      inheritAttrs(instance, subTree);
      patch(null, subTree, container, anchor);

      // 绑定实体节点
      // subTree 实际上就是组件配置对象中 render 返回的 VNode
      // 也就是说 subTree 就是一个 VNode
      // 而一开始挂载是在 render(Comp, document.body) 时
      // 这时 vnode 是 Comp
      // 可是实际上我们希望直接把 subTree 渲染到当前的 vnode 中
      // 因此要复用 vnode 的 el
      vnode.el = subTree.el;

      // 更新
      instance.isMounted = true;
    }

    // 更新
    else {
      // next 存在
      // 说明是被动更新
      if (instance.next) {
        // 将当前的 vnode 赋值为 n2
        vnode = instance.next;
        // 清空, 否则下次还进入这里
        instance.next = null;

        // 更新一下 props
        updateProps(instance, vnode);

        // 更新 ctx
        // 源码中是 proxyRef, 会主动更新
        // 而这里偷懒了, 因此要手动更新
        instance.ctx = {
          ...instance.props,
          ...instance.setupState
        };
      }

      // 正常的更新流程

      // 拿到原先的 VNode
      const prev = instance.subTree;

      // 拿到这次的 VNode
      const subTree = (instance.subTree = normalizeVNode(
        Component.render(instance.ctx)
      ));

      inheritAttrs(instance, subTree);
      patch(prev, subTree, container, anchor);
      vnode.el = subTree.el;
    }
  }, queueJob);
}

// TODO
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
