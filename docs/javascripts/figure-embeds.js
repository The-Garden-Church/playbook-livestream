window.addEventListener("message", (event) => {
  if (!event.data || typeof event.data.figure !== "string") return;
  for (const frame of document.querySelectorAll("iframe.figure-embed")) {
    if (frame.contentWindow === event.source) frame.style.height = `${event.data.height}px`;
  }
});

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-open-sheet]");
  if (opener) {
    const sheet = document.getElementById(opener.dataset.openSheet);
    const frame = sheet.querySelector("iframe[data-src]");
    if (!frame.src) frame.src = frame.dataset.src;
    sheet.showModal();
  }
  if (event.target.closest("[data-close-sheet]")) event.target.closest("dialog").close();
});
