const api = (p) => "http://127.0.0.1:8787" + p;

document.getElementById('init').onclick = async () => {
  const body = JSON.parse(document.getElementById('league').value || '{}');
  const r = await fetch(api('/api/league/init'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  alert('League init: ' + r.status);
};

document.getElementById('eval').onclick = async () => {
  const proposal = JSON.parse(document.getElementById('trade').value || '{}');
  const persona = document.getElementById('persona').value || 'Default';
  const r = await fetch(api('/api/trade/evaluate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposal, persona }),
  });
  const out = document.getElementById('out');
  out.textContent = await r.text();
};
