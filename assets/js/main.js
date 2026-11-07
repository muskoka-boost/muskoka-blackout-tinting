(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // nav background on scroll
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // mobile menu
  const toggle = $('.nav__toggle');
  const menu = $('#mobile-menu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    if (open) nav.classList.add('is-scrolled'); else onScroll();
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  // reveal on scroll
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
  $$('.reveal').forEach((el) => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', (Math.min(sibs.indexOf(el), 5) * 0.08) + 's');
    io ? io.observe(el) : el.classList.add('is-in');
  });

  // card glow follows cursor
  $$('.card').forEach(card => card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  }));

  // tint shade preview
  const range = $('#vlt');
  const win = $('.window');
  const out = $('#vltOut');
  const name = $('#vltName');
  const chips = $$('.shades__chips button');
  const label = (v) => v <= 10 ? 'Limo' : v <= 25 ? 'Dark' : v <= 40 ? 'Medium' : v <= 55 ? 'Light' : 'Very light';
  const setVlt = (v) => {
    v = Number(v);
    win.style.setProperty('--vlt', v);
    out.textContent = v + '%';
    name.textContent = label(v);
    chips.forEach(c => c.classList.toggle('is-active', Number(c.dataset.vlt) === v));
  };
  if (range) {
    range.addEventListener('input', () => setVlt(range.value));
    chips.forEach(c => c.addEventListener('click', () => { range.value = c.dataset.vlt; setVlt(c.dataset.vlt); }));
    setVlt(range.value);
  }

  // home / storefront cards preselect the quote form service
  $$('[data-service]').forEach((a) => a.addEventListener('click', () => {
    const sel = document.querySelector('#quoteForm select[name="service"]');
    if (sel) sel.value = a.dataset.service;
    const veh = document.querySelector('#quoteForm input[name="vehicle"]');
    if (veh && !veh.value) veh.placeholder = a.dataset.service.startsWith('Residential') ? 'e.g. 4 living room windows, about 3 x 5 ft' : 'e.g. 2 storefront windows + glass door';
  }));

  // footer year
  $('#year').textContent = new Date().getFullYear();

  // quote form
  const form = $('#quoteForm');
  const status = $('.form__status', form);
  const btn = $('button[type="submit"]', form);
  $('#formTs').value = String(Math.floor(Date.now() / 1000));
  const EMAIL = 'braedon@muskokablackouttinting.com';
  const isStaging = /github\.io$/.test(location.hostname) || location.protocol === 'file:';

  const say = (msg, kind) => { status.textContent = msg; status.className = 'form__status ' + (kind || ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
      f.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { say('Please fill in your name, a valid email and your vehicle or property.', 'err'); $('.is-invalid', form).focus(); return; }

    if (isStaging) {
      say('This is the preview site, so the form can\'t send yet. Please call (705) 644-3980 or email ' + EMAIL + '.', 'err');
      return;
    }

    btn.disabled = true;
    $('span', btn).textContent = 'Sending…';
    say('');
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        $('#formTs').value = String(Math.floor(Date.now() / 1000));
        say('Thanks! Your request was sent. Braedon will be in touch soon.', 'ok');
      } else {
        say(data.error || ('Something went wrong. Please call (705) 644-3980 or email ' + EMAIL + '.'), 'err');
      }
    } catch (err) {
      say('Couldn\'t send right now. Please call (705) 644-3980 or email ' + EMAIL + '.', 'err');
    } finally {
      btn.disabled = false;
      $('span', btn).textContent = 'Send quote request';
    }
  });
  $$('[required]', form).forEach(f => f.addEventListener('input', () => f.classList.remove('is-invalid')));
})();
