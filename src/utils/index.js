import { NodeTypes } from '../compiler/ast';

export function isObject(target) {
  return typeof target === 'object' && target !== null;
}

export function hasChanged(oldValue, value) {
  return oldValue !== value && !(Number.isNaN(oldValue) && Number.isNaN(value));
}

export function isArray(target) {
  return Array.isArray(target);
}

export function isFunction(target) {
  return typeof target === 'function';
}

export function isString(target) {
  return typeof target === 'string';
}

export function isNumber(target) {
  return typeof target === 'number';
}

export function isBoolean(target) {
  return typeof target === 'boolean';
}

export function isSymbol(val) {
  return typeof val === 'symbol';
}

export function isText(node) {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT;
}

// 驼峰化
export function camelize(str) {
  // e.g
  // my-first-name
  // myFirstName
  // replace 第二个参数可以是一个函数
  // 这个函数接收两个参数
  //      match: 匹配到的子串
  //      p1,p2,p3...: 假如 replace 第一个参数是正则表达式
  //                   则代表第 n 个括号匹配到的字符串
  // 如上例子中
  // nerverUse 是 -f、-n
  // c 是 f、n
  return str.replace(/-(\w)/g, (neverUse, c) => (c ? c.toUpperCase() : ''));
}

// 所有 html 标准原生标签
// vue-next/packages/shared/domTagConfig.ts r6
const HTML_TAGS =
  'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
  'header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,' +
  'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
  'data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,' +
  'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
  'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
  'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
  'option,output,progress,select,textarea,details,dialog,menu,' +
  'summary,template,blockquote,iframe,tfoot';

// 一些自闭合标签，不写 "/>" 也可以的自闭合标签
// vue-next/packages/shared/domTagConfig.ts r30
const VOID_TAGS =
  'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr';

const makeMap = (str) => {
  const map = Object.create(null);
  const list = str.split(',');
  for (const l of list) {
    map[l] = true;
  }

  return (val) => !!map[val];
};

// vue-next/packages/shared/domTagConfig.ts r33
export const isHTMLTag = makeMap(HTML_TAGS);
// vue-next/packages/shared/domTagConfig.ts r35
export const isVoidTag = makeMap(VOID_TAGS);

export function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

export const extend = Object.assign;

export function isStaticExp(p) {
  p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic;
}
