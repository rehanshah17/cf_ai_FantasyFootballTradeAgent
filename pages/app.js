const api = (p) => `${location.origin}${p}`; // use the same origin as the page


document.getElementById('init').onclick = async () => {
const body = JSON.parse(document.getElementById('league').value || '{}');
const r = await fetch(api('/api/league/init'), { method: 'POST', body: JSON.stringify(body) });
alert('League init: ' + r.status);
};


document.getElementById('eval').onclick = async () => {
const proposal = JSON.parse(document.getElementById('trade').value || '{}');
const persona = document.getElementById('persona').value;
const r = await fetch(api('/api/trade/evaluate'), { method: 'POST', body: JSON.stringify({ proposal, persona }) });
const out = document.getElementById('out');
out.textContent = await r.text();
};