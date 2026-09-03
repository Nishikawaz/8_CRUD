/**
 * Frontend en JavaScript puro. Sin frameworks ni librerias.
 *
 * La pagina YA funciona sin este archivo: cada boton es un <form> real que
 * hace POST y redirige. Este script intercepta esos envios, habla con la
 * misma ruta por fetch y actualiza solo lo que cambio. Si no carga, no se
 * rompe nada: simplemente se recarga la pagina.
 */
(function () {
  'use strict';

  var csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  var live = document.getElementById('live-region');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function announce(text) { if (live) live.textContent = text; }

  /** Mutacion contra la propia app, siempre con el token CSRF. */
  function send(url, method) {
    return fetch(url, {
      method: method,
      headers: { Accept: 'application/json', 'X-CSRF-Token': csrf },
      credentials: 'same-origin',
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok && data.ok) return data;
        var err = new Error(data.error || (data.errors || []).join(' ') || 'Error ' + res.status);
        err.status = res.status;
        throw err;
      });
    });
  }

  // ------------------------------------------------------------------ votos

  var ON  = ['border-indigo-500', 'bg-indigo-50', 'text-indigo-700', 'dark:border-indigo-400', 'dark:bg-indigo-950', 'dark:text-indigo-300'];
  var OFF = ['border-slate-200', 'bg-white', 'text-slate-500', 'hover:border-indigo-400', 'hover:text-indigo-600', 'dark:border-slate-700', 'dark:bg-slate-800', 'dark:hover:border-indigo-500'];

  function paint(form, votes, voted) {
    var btn = form.querySelector('.js-vote-btn');
    var count = form.querySelector('.js-count');
    if (count) count.textContent = votes;
    if (!btn) return;
    btn.setAttribute('aria-pressed', voted ? 'true' : 'false');
    btn.title = voted ? 'Quitar mi voto' : 'Votar';
    (voted ? OFF : ON).forEach(function (c) { btn.classList.remove(c); });
    (voted ? ON : OFF).forEach(function (c) { btn.classList.add(c); });
    var sr = btn.querySelector('.sr-only');
    if (sr) sr.textContent = 'votos · ' + (voted ? 'ya votaste' : 'votar');
  }

  /**
   * Reordena la lista siguiendo el orden que mando el SERVIDOR, con animacion
   * FLIP: se miden las posiciones antes de mover, se mueve, se vuelve a medir
   * y se aplica la diferencia como transform invertido para que el navegador
   * lo anime hasta cero.
   */
  function reorder(list, order, itemSelector) {
    if (!list || !order) return;
    var items = Array.prototype.slice.call(list.querySelectorAll(itemSelector));
    if (items.length < 2) return;

    var byId = {}, before = [];
    items.forEach(function (el) {
      byId[el.dataset.id] = el;
      before.push({ el: el, top: el.getBoundingClientRect().top });
    });

    // Solo los ids presentes: con una busqueda activa el orden trae temas que no se muestran.
    var visible = order.filter(function (id) { return byId[id]; });
    if (visible.join() === items.map(function (el) { return el.dataset.id; }).join()) return;

    visible.forEach(function (id) { list.appendChild(byId[id]); });   // appendChild mueve, no duplica
    if (reduceMotion) return;

    before.forEach(function (b) {
      var delta = b.top - b.el.getBoundingClientRect().top;
      if (!delta) return;
      b.el.style.transition = 'none';
      b.el.style.transform = 'translateY(' + delta + 'px)';
      void b.el.offsetHeight;   // fuerza el layout; sin esto no hay transicion que animar
      b.el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
      b.el.style.transform = '';
    });
  }

  function vote(form) {
    var btn = form.querySelector('.js-vote-btn');
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;

    send(form.action, 'POST')
      .then(function (data) {
        paint(form, data.votes, data.voted);
        if (data.type === 'topic') reorder(document.getElementById('topic-list'), data.order, '.js-topic');
        else reorder(document.getElementById('link-list'), data.order, '.js-link');
        announce((data.voted ? 'Voto registrado. ' : 'Voto retirado. ') + data.votes + ' votos.');
      })
      .catch(function (err) {
        // Un voto fallido no puede dejar la pantalla mintiendo: se vuelve al estado del servidor.
        window.alert('No se pudo registrar el voto: ' + err.message);
        window.location.reload();
      })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  // ----------------------------------------------------------------- borrado

  function remove(form) {
    if (!window.confirm(form.dataset.confirm || '¿Confirmas la eliminacion?')) return;
    var url = form.action.replace(/[?&]_method=DELETE/i, '');   // por fetch va el verbo real

    send(url, 'DELETE')
      .then(function (data) {
        var node = document.querySelector('.js-link[data-id="' + data.id + '"], .js-topic[data-id="' + data.id + '"]');
        if (!node) { window.location.href = '/'; return; }   // era el tema que estabamos mirando
        node.style.transition = 'opacity 180ms, transform 180ms';
        node.style.opacity = '0';
        node.style.transform = 'scale(0.97)';
        setTimeout(function () { node.remove(); }, 180);
        announce('Elemento eliminado.');
      })
      .catch(function (err) { window.alert('No se pudo eliminar: ' + err.message); });
  }

  // -------------------------------------------------------------- validacion

  /**
   * Mensajes en espanol y el chequeo de "las contrasenas coinciden", que
   * ningun atributo HTML cubre. Es comodidad, no seguridad: el servidor
   * revalida todo en middleware/validate.js.
   *
   * `noValidate` se pone DESDE JS y nunca en el HTML. Sin esto el navegador
   * aborta el envio antes de disparar `submit` y este codigo no corre nunca;
   * el usuario ve la burbuja nativa en vez de estos mensajes. Puesto desde
   * JS, un navegador sin el script conserva su validacion nativa.
   */
  function messageFor(field) {
    var v = field.validity;
    if (v.valueMissing) return 'Este campo es obligatorio.';
    if (v.typeMismatch && field.type === 'url') return 'Escribi una URL valida (https://…).';
    if (v.tooShort) return 'Necesita al menos ' + field.minLength + ' caracteres.';
    if (v.tooLong) return 'No puede superar los ' + field.maxLength + ' caracteres.';
    if (v.patternMismatch) return 'Solo se admiten letras, numeros y los signos . _ -';
    return field.validationMessage || 'Revisa este campo.';
  }

  // Id unico por formulario: en la vista de un tema conviven varios <form> con un campo "title".
  function errorId(field) {
    return field.id ? field.id + '-error' : 'f' + (field.form.dataset.vid || '') + '-' + field.name + '-error';
  }

  function showError(field) {
    var id = errorId(field);
    var hint = document.getElementById(id);
    if (!hint) {
      hint = document.createElement('p');
      hint.id = id;
      hint.className = 'mt-1 text-xs text-rose-600 dark:text-rose-400';
      field.insertAdjacentElement('afterend', hint);
    }
    hint.textContent = messageFor(field);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', id);
    field.classList.add('border-rose-500');
  }

  function clearError(field) {
    var hint = document.getElementById(errorId(field));
    if (hint) hint.remove();
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    field.classList.remove('border-rose-500');
  }

  function wireValidation(form, index) {
    form.noValidate = true;
    form.dataset.vid = String(index);
    var match = form.querySelector('[data-match]');

    function checkMatch() {
      if (!match) return;
      var other = form.querySelector('#' + match.dataset.match);
      match.setCustomValidity(other && match.value && match.value !== other.value ? 'Las contrasenas no coinciden.' : '');
    }

    form.addEventListener('input', function (e) {
      if (e.target === match) checkMatch();
      if (e.target.validity && e.target.validity.valid) clearError(e.target);
    });

    form.addEventListener('submit', function (e) {
      checkMatch();
      if (form.checkValidity()) return;
      e.preventDefault();
      var first = null;
      Array.prototype.forEach.call(form.elements, function (f) {
        if (!f.willValidate) return;
        if (f.checkValidity()) return clearError(f);
        showError(f);
        if (!first) first = f;
      });
      if (first) first.focus();
    });
  }

  // ---------------------------------------------------------------- cableado

  // Un unico listener delegado: los formularios que se mueven al reordenar siguen funcionando.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.classList.contains('js-vote')) { e.preventDefault(); vote(form); }
    else if (form.classList.contains('js-delete')) { e.preventDefault(); remove(form); }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.js-validated'), wireValidation);

  var search = document.getElementById('q');
  if (search) {
    var timer;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { search.form.submit(); }, 400);
    });
  }
})();
