import { capitalize } from '../utils';

export * from './patchFlags';
export * from './shapeFlags';

const onRE = /^on[^a-z]/;
export const isOn = (key) => onRE.test(key);

export const objectToString = Object.prototype.toString;

export const toHandlerKey = (str) => (str ? `on${capitalize(str)}` : '');
