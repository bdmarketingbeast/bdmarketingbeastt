/* Bd Marketing Beast template: shared scripts. Do not edit; content is changed from /admin. */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* preloader (only when the page has one) */
  var pre = document.getElementById('pre');
  if (pre) {
    var pn = document.getElementById('pn'), pb = document.getElementById('pb'), p = 0;
    var t = setInterval(function(){
      p += Math.random()*14 + 4;
      if (p >= 100) { p = 100; clearInterval(t); setTimeout(function(){ pre.classList.add('done'); }, 250); }
      pn.textContent = Math.floor(p); pb.style.width = p + '%';
    }, 90);
    setTimeout(function(){ pre.classList.add('done'); }, 3500);
  }

  /* header + mobile menu */
  var hd = document.getElementById('hd');
  if (hd) {
    var sc = function(){ hd.classList.toggle('scrolled', window.scrollY > 20); };
    sc(); window.addEventListener('scroll', sc, {passive:true});
    var links = document.getElementById('links'), menu = document.getElementById('menu');
    if (links && menu) {
      menu.addEventListener('click', function(){ links.classList.toggle('open'); });
      links.addEventListener('click', function(e){ if (e.target.tagName === 'A') links.classList.remove('open'); });
    }
  }

  /* marquee: duplicate for a seamless loop */
  document.querySelectorAll('.track').forEach(function(tr){ tr.innerHTML += tr.innerHTML; });

  /* reveal on scroll + counters */
  function count(el){
    var end = +el.dataset.count, suf = el.dataset.suffix || '', s = null, d = 1400;
    function f(ts){ if (!s) s = ts; var k = Math.min((ts - s)/d, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end*e) + suf; if (k < 1) requestAnimationFrame(f); }
    requestAnimationFrame(f);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(x){
        if (!x.isIntersecting) return;
        x.target.classList.add('in');
        var c = x.target.querySelector('[data-count]'); if (c) count(c);
        io.unobserve(x.target);
      });
    }, {threshold:.15});
    document.querySelectorAll('.rv,.step,.panel').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.rv,.step,.panel').forEach(function(el){ el.classList.add('in'); });
    document.querySelectorAll('[data-count]').forEach(function(c){ c.textContent = c.dataset.count + (c.dataset.suffix || ''); });
  }

  /* card glow follows the cursor */
  document.querySelectorAll('.card').forEach(function(c){
    c.addEventListener('pointermove', function(e){
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* hero network animation */
  var cv = document.getElementById('net');
  if (cv && cv.getContext) {
    var cx = cv.getContext('2d'), W, H, pts = [], mouse = {x:-999,y:-999}, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rgb = getComputedStyle(document.documentElement).getPropertyValue('--blue-rgb').trim().split(/\s+/).join(',') || '30,107,255';
    var crgb = getComputedStyle(document.documentElement).getPropertyValue('--cyan-rgb').trim().split(/\s+/).join(',') || '56,189,248';
    var size = function(){
      var r = cv.parentElement.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W*dpr; cv.height = H*dpr; cx.setTransform(dpr,0,0,dpr,0,0);
      var n = Math.min(90, Math.floor(W*H/17000)); pts = [];
      for (var i = 0; i < n; i++) pts.push({x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-.5)*.35, vy:(Math.random()-.5)*.35});
    };
    size(); window.addEventListener('resize', size);
    cv.parentElement.addEventListener('pointermove', function(e){ var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    cv.parentElement.addEventListener('pointerleave', function(){ mouse.x = mouse.y = -999; });
    var vis = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function(e){ vis = e[0].isIntersecting; }).observe(cv);
    var draw = function(){
      requestAnimationFrame(draw); if (!vis) return;
      cx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i];
        if (!reduce) { a.x += a.vx; a.y += a.vy; }
        if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1;
        var dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm < 140 && !reduce) { a.x += (a.x - mouse.x)*.012; a.y += (a.y - mouse.y)*.012; }
        cx.beginPath(); cx.arc(a.x, a.y, 1.8, 0, 6.283); cx.fillStyle = dm < 140 ? 'rgb(' + crgb + ')' : 'rgba(' + rgb + ',.8)'; cx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 125) { cx.strokeStyle = 'rgba(' + rgb + ',' + (0.28*(1 - d/125)) + ')'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
        }
        if (dm < 170) { cx.strokeStyle = 'rgba(' + crgb + ',' + (0.5*(1 - dm/170)) + ')'; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mouse.x, mouse.y); cx.stroke(); }
      }
    };
    draw();
  }

  /* lead forms: send with Web3Forms, then go to the thank-you page */
  document.querySelectorAll('form[data-lead]').forEach(function(form){
    var status = form.querySelector('.status'), btn = form.querySelector('button[type=submit]');
    var label = btn ? btn.textContent : '';
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if (form.elements.botcheck && form.elements.botcheck.checked) return;
      var key = form.dataset.key || '';
      if (!key) { status.style.color = '#ff8a8a'; status.textContent = 'Form is not connected yet. Add the Web3Forms key in Site settings.'; return; }
      var data = {}; new FormData(form).forEach(function(v, k){ data[k] = v; });
      data.access_key = key;
      data.subject = form.dataset.subject || 'New lead from the website';
      data.from_name = form.dataset.from || 'Website';
      data.page_url = location.href;
      btn.disabled = true; btn.textContent = form.dataset.sending || 'Sending...'; status.style.color = ''; status.textContent = '';
      fetch('https://api.web3forms.com/submit', {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body:JSON.stringify(data)})
        .then(function(r){ return r.json(); })
        .then(function(j){
          if (!j.success) throw new Error(j.message || 'fail');
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({event:'generate_lead', form_name:form.dataset.formName || 'contact_form', service_selected:data.svc || ''});
          setTimeout(function(){ window.location.href = form.dataset.thanks || '/thank-you.html'; }, 400);
        })
        .catch(function(err){
          btn.disabled = false; btn.textContent = label;
          status.style.color = '#ff8a8a';
          status.textContent = (form.dataset.error || 'Something went wrong. Please call us instead.') + ' (' + ((err && err.message) || 'error') + ')';
        });
    });
  });

  /* thank-you pages tell Tag Manager they were viewed */
  var ty = document.querySelector('[data-thankyou-event]');
  if (ty) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({event: ty.getAttribute('data-thankyou-event')}); }

  var yr = document.querySelectorAll('.js-year'); yr.forEach(function(el){ el.textContent = new Date().getFullYear(); });
})();
