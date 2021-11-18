/* eslint-disable no-case-declarations */
import {
  ElementTypes,
  NodeTypes,
  createVNodeCall,
  createSimpleExpression,
  createObjectProperty,
  createObjectExpression,
  createCallExpression
} from '../ast';
import { PatchFlagNames, PatchFlags, isOn } from '../../shared';
import { isStaticExp } from '../../utils';

export const transformElement = (node, context) => {
  return function postTransformElement() {
    node = context.currentNode;

    // 只对元素节点进行处理
    if (node.type !== NodeTypes.ELEMENT) {
      return;
    }

    const { tag, props } = node;
    const isComponent = node.tagType === ElementTypes.COMPONENT;

    let vnodeTag = `"${tag}"`;
    let vnodeProps;
    let vnodeChildren;
    let vnodePatchFlag;
    let patchFlag = 0;
    let vnodeDynamicProps;
    let dynamicPropNames;
    let vnodeDirectives;

    // props
    if (props.length > 0) {
      const propsBuildResult = buildProps(node, context);
      vnodeProps = propsBuildResult.props;
      patchFlag = propsBuildResult.patchFlag;
      dynamicPropNames = propsBuildResult.dynamicPropNames;
      vnodeDirectives = propsBuildResult.directives;
    }

    // children
    if (node.children.length > 0) {
      if (node.children.length === 1) {
        const child = node.children[0];
        const type = child.type;

        // 分析是否存在动态文本子节点，插值表达式和复合文本节点
        const hasDynamicTextChild =
          type === NodeTypes.INTERPOLATION ||
          type === NodeTypes.COMPOUND_EXPRESSION;

        // 有动态文本子节点则修改 patchFlag
        if (hasDynamicTextChild) {
          patchFlag |= PatchFlags.TEXT;
        }

        // 获取 vnodeChildren
        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child;
        } else {
          vnodeChildren = node.children;
        }
      } else {
        vnodeChildren = node.children;
      }
    }

    // 格式化 patchFlag
    if (patchFlag !== 0) {
      if (patchFlag < 0) {
        vnodePatchFlag = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`;
      } else {
        const flagNames = Object.keys(PatchFlagNames)
          .map(Number)
          .filter((n) => n > 0 && patchFlag & n)
          .map((n) => PatchFlagNames[n])
          .join(', ');

        // 将上面的内容注释在 patchFlag 后面作为一个参考
        vnodePatchFlag = patchFlag + ` /* ${flagNames} */`;
      }

      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames);
      }
    }

    node.codegenNode = createVNodeCall(
      node.type,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
      vnodePatchFlag,
      vnodeDynamicProps,
      vnodeDirectives,
      isComponent
    );
  };
};

function buildProps(node, context, props = node.props) {
  const isComponent = node.tagType === ElementTypes.COMPONENT;
  let properties = [];
  const mergeArgs = [];
  const runtimeDirectives = [];

  // patchFlag analysis
  let patchFlag = 0;
  let hasClassBinding = false;
  let hasStyleBinding = false;
  let hasHydrationEventBinding = false;
  let hasDynamicKeys = false;
  const dynamicPropNames = [];

  const analyzePatchFlag = ({ key }) => {
    if (isStaticExp(key)) {
      const name = key.content;
      const isEventHandler = isOn(name);

      if (
        !isComponent &&
        isEventHandler &&
        name.toLowerCase() !== 'onclick'
        // 源码这里还会忽略 v-model 双向绑定
        // 源码这里还会忽略 onVnodeXXX hooks
      ) {
        hasHydrationEventBinding = true;
      }

      // 源码在这里会忽略 cacheHandler 以及有静态值的属性

      if (name === 'class') {
        hasClassBinding = true;
      } else if (name === 'style') {
        hasStyleBinding = true;
      } else if (name !== 'key' && !dynamicPropNames.includes(name)) {
        dynamicPropNames.push(name);
      }

      // 将组件上绑定的类名以及样式视为动态属性
      if (
        isComponent &&
        (name === 'class' || name === 'style') &&
        !dynamicPropNames.includes(name)
      ) {
        dynamicPropNames.push(name);
      }
    } else {
      // 属性名不是简单表达式 (SIMPLE_EXPRESSION) 的话
      // 则视为有动态键名
      hasDynamicKeys = true;
    }
  };

  for (let i = 0; i < props.length; i++) {
    // static attribute
    const prop = props[i];
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { name, value } = prop;
      let valueNode = createSimpleExpression(value || '', true);

      properties.push(
        createObjectProperty(createSimpleExpression(name, true), valueNode)
      );
    } else {
      // directives
      const { name, arg, exp } = prop;
      const isVBind = name === 'bind';
      const isVOn = name === 'on';

      // 源码这里会跳过以下指令
      // v-slot
      // v-once/v-memo
      // v-is/:is
      // SSR 环境下的 v-on

      // 处理无参数的 v-bind 以及 v-on
      if (!arg && (isVBind || isVOn)) {
        hasDynamicKeys = true;
        if (exp) {
          if (properties.length) {
            mergeArgs.push(createObjectExpression(properties));
            properties = [];
          }

          if (isVBind) {
            mergeArgs.push(exp);
          } else {
            // v-on="obj" -> toHandlers(obj)
            mergeArgs.push({
              type: NodeTypes.JS_CALL_EXPRESSION,
              arguments: [exp]
            });
          }
        }

        continue;
      }

      const directiveTransform = context.directiveTransforms[name];
      // 内置指令
      if (directiveTransform) {
        const { props, needRuntime } = directiveTransform(prop, node, context);
        props.forEach(analyzePatchFlag);
        properties.push(...props);
        if (needRuntime) {
          runtimeDirectives.push(prop);
        }
      }

      // 自定义指令
      else {
        runtimeDirectives.push(prop);
      }
    }
  }

  let propsExpression = undefined;

  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(createObjectExpression(properties));
    }

    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(mergeArgs);
    } else {
      // 只有一个 v-bind
      propsExpression = mergeArgs[0];
    }
  } else if (properties.length) {
    propsExpression = createObjectExpression(properties);
  }

  // patchFlag analysis
  if (hasDynamicKeys) {
    patchFlag |= PatchFlags.FULL_PROPS;
  } else {
    if (hasClassBinding && !isComponent) {
      patchFlag |= PatchFlags.CLASS;
    }
    if (hasStyleBinding && !isComponent) {
      patchFlag |= PatchFlags.STYLE;
    }
    if (dynamicPropNames.length) {
      patchFlag |= PatchFlags.PROPS;
    }
    if (hasHydrationEventBinding) {
      patchFlag |= PatchFlags.HYDRATE_EVENTS;
    }
  }

  // 这里在源码中还会考虑 ref 以及 vnodeHook
  if (
    (patchFlag === 0 || patchFlag === PatchFlags.HYDRATE_EVENTS) &&
    runtimeDirectives.length > 0
  ) {
    patchFlag |= PatchFlags.NEED_PATCH;
  }

  // 规范化 props
  if (propsExpression) {
    switch (propsExpression.type) {
      case NodeTypes.JS_OBJECT_EXPRESSION:
        // 说明 props 中没有 v-bind，只需要处理动态的属性绑定
        let classKeyIndex = -1;
        let styleKeyIndex = -1;
        let hasDynamicKey = false;

        for (let i = 0; i < propsExpression.properties.length; i++) {
          const key = propsExpression.properties[i].key;
          if (isStaticExp(key)) {
            if (key.content === 'class') {
              classKeyIndex = i;
            } else if (key.content === 'style') {
              styleKeyIndex = i;
            }
          } else if (!key.isHandlerKey) {
            hasDynamicKey = true;
          }
        }

        const classProp = propsExpression.properties[classKeyIndex];
        const styleProp = propsExpression.properties[styleKeyIndex];

        // no dynamic key
        if (!hasDynamicKey) {
          // 类名的值是动态的话则包装一下类名的值
          if (classProp && !isStaticExp(classProp.value)) {
            classProp.value = createCallExpression([classProp.value]);
          }

          // 样式的值是动态的则包装一下样式的值
          if (
            styleProp &&
            !isStaticExp(styleProp.value) &&
            (hasStyleBinding ||
              styleProp.value.type === NodeTypes.JS_ARRAY_EXPRESSION)
          ) {
            styleProp.value = createCallExpression([styleProp.value]);
          }
        }

        // 有动态键名则直接包装整个 propsExpression
        else {
          propsExpression = createCallExpression([propsExpression]);
        }
        break;
      case NodeTypes.JS_CALL_EXPRESSION:
        // 不需要处理
        break;

      default:
        // 只有 v-bind 直接包装整个 propsExpression
        propsExpression = createCallExpression([
          createCallExpression([propsExpression])
        ]);
        break;
    }
  }

  return {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames
  };
}

function stringifyDynamicPropNames(props) {
  let propsNamesString = '[';
  for (let i = 0, l = props.length; i < l; i++) {
    propsNamesString += JSON.stringify(props[i]);
    if (i < l - 1) propsNamesString += ',';
  }
  return propsNamesString + ']';
}
