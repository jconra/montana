// Long scene-building loops call breathe() as they go. Once a slice of work has run for `budget` ms it yields, so the
// browser can draw a frame (the loading screen's fire keeps flickering) before the loop carries on. Results are
// unchanged: only when the work happens moves.
export function breather(budget=10){
  let start=performance.now();
  const pause=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(r=>setTimeout(r,0));
  return async function breathe(){if(performance.now()-start<budget)return;await pause();start=performance.now();};
}
