const queue = [];
let isFlushPending = false;
let currentFlushPromise = null;
const resolvePromise = Promise.resolve();

export function queueJob(job) {
  if (!queue.length || !queue.includes(job)) {
    queue.push(job);
    queueFlush();
  }
}

function queueFlush() {
  if (!isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvePromise.then(flushJobs);
  }
}

function flushJobs() {
  // job 里面有可能是用户代码，可能出错
  // 因此用 try-catch 包一下
  try {
    for (const job of queue) {
      job();
    }
  } finally {
    isFlushPending = false;
    queue.length = 0;
    currentFlushPromise = null;
  }
}

export function nextTick(fn) {
  const p = currentFlushPromise || resolvePromise;
  return fn ? p.then(fn) : p;
}
