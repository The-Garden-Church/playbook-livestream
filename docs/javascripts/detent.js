(function () {
  var GAP_MS = 35;
  var PULSE_MS = 10;
  var coarse = window.matchMedia("(pointer: coarse)");
  var last = -Infinity;
  var label = null;

  function iosSwitch() {
    if (!label) {
      label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;pointer-events:none";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      label.append(input);
      label.addEventListener("click", function (event) { event.stopPropagation(); });
      document.body.append(label);
    }
    var held = document.activeElement;
    label.click();
    if (held && held !== document.activeElement && held.focus) held.focus({ preventScroll: true });
  }

  window.detent = function () {
    var now = performance.now();
    if (now - last < GAP_MS) return;
    if (typeof navigator.vibrate === "function") {
      last = now;
      navigator.vibrate(PULSE_MS);
    } else if (coarse.matches) {
      last = now;
      iosSwitch();
    }
  };
})();
