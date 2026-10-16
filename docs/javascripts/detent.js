(function () {
  var GAP_MS = 35;
  var PULSE_MS = 10;
  var last = -Infinity;

  window.detent = function () {
    var now = performance.now();
    if (now - last < GAP_MS || typeof navigator.vibrate !== "function") return;
    last = now;
    navigator.vibrate(PULSE_MS);
  };
})();
