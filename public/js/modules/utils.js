// =======================
// Utility functions
// =======================
export function typeWriter(el, text, delay = 30) {
  el.textContent = ""; // clear existing content
  let i = 0;
  function write() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(write, delay);
    }
  }
  write();
}
