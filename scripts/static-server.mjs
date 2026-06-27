// Minimal static server for the exported `out/` dir, used by Playwright.
const root = new URL('../out/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4319);

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const rel = path.replace(/^\/+/, '');
    let file = Bun.file(root + rel);
    if (!(await file.exists())) file = Bun.file(root + rel + '/index.html');
    if (!(await file.exists())) file = Bun.file(root + '404.html');
    return new Response(file);
  },
});
console.log(`static-server: serving out/ on http://localhost:${port}`);
