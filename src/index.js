import { baseCompile as compile } from './compiler';
import { createApp, render, h, Text } from './runtime';
import { reactive, ref, effect, computed } from './reactivity';

window.BeggarVue = {
  createApp,
  render,
  h,
  Text,
  compile,
  reactive,
  ref,
  effect,
  computed
};
