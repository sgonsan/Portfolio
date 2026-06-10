// Header values must never contain CR/LF — prevents SMTP/HTTP header injection.
function stripCrlf(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

// CSV cell: always quoted, embedded quotes doubled, and cells that a
// spreadsheet would evaluate as a formula get a leading apostrophe.
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

module.exports = { stripCrlf, csvCell };
