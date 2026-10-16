window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data.figure !== "string") return;
  for (const frame of document.querySelectorAll("iframe.figure-embed")) {
    if (frame.contentWindow === event.source) frame.style.height = `${event.data.height}px`;
  }
});
