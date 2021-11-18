import { extend, isString } from '../utils';
import { generate } from './codegen';
import { baseParse } from './parse';
import { transform } from './transform';
import { transformElement } from './transforms/transformElement';
import { transformText } from './transforms/transformText';
import { transformOn } from './transforms/vOn';
import { transformBind } from './transforms/vBind';

export function getBaseTransformPreset() {
  // 插件预设
  return [
    [transformElement, transformText],
    {
      on: transformOn,
      bind: transformBind
    }
  ];
}

export function baseCompile(template, options = {}) {
  const ast = isString(template) ? baseParse(template, options) : template;

  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset();

  // 这里的 extend 实际上就是 Object.assign()
  transform(
    ast,
    extend({}, options, {
      nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {} // user transforms
      )
    })
  );

  return generate(ast, extend({}, options));
}
