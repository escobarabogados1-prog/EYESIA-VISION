function createAnalysisQueue({ analyze, onResult }) {
  let active = false;
  let pendingEvent = null;
  const idleWaiters = [];
  const state = {
    received: 0,
    completed: 0,
    failed: 0,
    coalesced: 0,
    staleResults: 0,
    lastError: null,
    lastDurationMs: null
  };

  function getState() {
    return {
      ...state,
      active,
      pending: pendingEvent ? 1 : 0
    };
  }

  function notifyIdle() {
    if (active || pendingEvent) return;

    while (idleWaiters.length > 0) {
      idleWaiters.shift()();
    }
  }

  function run(event) {
    active = true;
    const startedAt = Date.now();

    Promise.resolve()
      .then(() => analyze(event))
      .then((result) => {
        state.completed += 1;
        state.lastError = null;

        if (typeof onResult === 'function' && !onResult(event, result)) {
          state.staleResults += 1;
        }
      })
      .catch((error) => {
        state.failed += 1;
        state.lastError = error.message;
        console.error(`Error analizando evento ${event.event_id}:`, error.message);
      })
      .finally(() => {
        state.lastDurationMs = Date.now() - startedAt;
        active = false;

        if (pendingEvent) {
          const nextEvent = pendingEvent;
          pendingEvent = null;
          run(nextEvent);
          return;
        }

        notifyIdle();
      });
  }

  function enqueue(event) {
    state.received += 1;

    if (active) {
      if (pendingEvent) state.coalesced += 1;
      pendingEvent = event;
    } else {
      run(event);
    }

    return getState();
  }

  function waitForIdle() {
    if (!active && !pendingEvent) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }

  return {
    enqueue,
    getState,
    waitForIdle
  };
}

module.exports = {
  createAnalysisQueue
};