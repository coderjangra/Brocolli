// Renders src/legal/privacy.json (the same text the app shows) to
// docs/privacy/index.html for hosting (e.g. GitHub Pages) as the Play Store
// privacy policy URL.  Usage: node scripts/build-privacy-html.mjs [contact-email]
import { readFileSync, writeFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync(new URL('../src/legal/privacy.json', import.meta.url), 'utf8'));
const email = process.argv[2];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const contact = email
  ? `Questions or requests: <a href="mailto:${esc(email)}">${esc(email)}</a>`
  : esc(policy.contact);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(policy.title)}</title>
<style>
  :root { --bg:#F7FAF8; --text:#0B0F0C; --muted:#475569; --brand:#15803D; --card:#FFFFFF; --border:#D5DED8; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0B0F0C; --text:#F1F5F2; --muted:#94A3B8; --brand:#22C55E; --card:#141A16; --border:#27322B; } }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:28px; margin:0 0 4px; } h2 { font-size:19px; margin:28px 0 8px; color:var(--brand); }
  .muted { color:var(--muted); } section { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:4px 20px; margin-top:8px; }
  li { margin:8px 0; } a { color:var(--brand); }
</style>
</head>
<body><main>
<h1>${esc(policy.title)}</h1>
<p class="muted">Effective ${esc(policy.effective)}</p>
<p>${esc(policy.intro)}</p>
${policy.sections
  .map((s) => `<h2>${esc(s.heading)}</h2><section><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>`)
  .join('\n')}
<p class="muted" style="margin-top:32px">${contact}</p>
</main></body>
</html>
`;
writeFileSync(new URL('../docs/privacy/index.html', import.meta.url), html);
console.log('wrote docs/privacy/index.html');
