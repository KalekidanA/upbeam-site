// Sends the waitlist form without leaving the page. Works without this script too.
for (const f of document.querySelectorAll('form.waitlist')) {
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = f.querySelector('.wl-msg'), btn = f.querySelector('button');
    btn.disabled = true; msg.textContent = 'Joining…';
    try {
      const r = await fetch(f.action, { method: 'POST', body: new FormData(f), headers: { accept: 'application/json' } });
      const d = await r.json();
      msg.textContent = d.message;
      if (d.ok) { f.classList.add('done'); f.querySelector('input[type=email]').value = ''; }
    } catch { msg.textContent = 'Something went wrong. Please try again.'; }
    btn.disabled = false;
  });
}
