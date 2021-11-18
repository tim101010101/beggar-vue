// 存储任务的队列
const queue = [];

// 是否正在执行 flush
let isFlushPending = false;

// 保存当前的 promise
let currentFlushPromise = null;

const resolvePromise = Promise.resolve();

export function queueJob(job) {
  // 空队列才 push
  // 顺便去重
  if (!queue.length || !queue.includes(job)) {
    // 入队
    queue.push(job);
    queueFlush();
  }
}

// 要放在微任务中，不能让他立刻执行
// 因为如果是同步任务就没有意义了
function queueFlush() {
  if (!isFlushPending) {
    // 现在要开始执行任务了
    isFlushPending = true;
    currentFlushPromise = resolvePromise.then(flushJobs);
  }
}

function flushJobs() {
  // 清空操作
  // job 里面有可能是用户代码，可能出错
  // 因此用 try-catch 包一下
  try {
    for (const job of queue) {
      job();
    }
  } finally {
    // 还原 isFlushPending
    isFlushPending = false;
    // 清空队列
    queue.length = 0;
    currentFlushPromise = null;
  }
}

export function nextTick(fn) {
  const p = currentFlushPromise || resolvePromise;
  // return p.then(fn);

  // 为了兼容 await 用法
  return fn ? p.then(fn) : p;
}
