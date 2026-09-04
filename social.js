/* Comunidad, retos y Ferchy Cards. Requiere las tablas y funciones de db/schema.sql. */
(function () {
  const RARITY = {
    common: { label: 'Común', icon: '🥕' },
    normal: { label: 'Normal', icon: '🩺' },
    rare: { label: 'Rara · oro', icon: '✨' }
  };
  const CHEER = [
    ['Rabanitos te vigila', 'Cinco minutos más: tu yo de guardia te lo agradecerá.', '🥕'],
    ['Café con propósito', 'No estudies por miedo: estudia para reconocer lo importante.', '☕'],
    ['No te duermas', 'La cama te extraña, pero el conocimiento también.', '😴'],
    ['Mini victoria', 'Una pregunta entendida vale más que diez leídas sin atención.', '🏁'],
    ['Chiste de guardia', '¿Por qué el estetoscopio aprobó? Porque siempre escuchó bien.', '🩺'],
    ['Modo curiosidad', 'Pregunta “¿por qué?” hasta que el concepto se vuelva tuyo.', '🔎'],
    ['Reto amable', 'Tu cerebro no necesita perfección: necesita repetición.', '🧠'],
    ['Pausa activa', 'Respira, toma agua y vuelve: la memoria también descansa.', '💧'],
    ['Alerta de siesta', 'Si bostezas, cambia de tema; no cambies tu meta.', '⏰'],
    ['Guardia imaginaria', 'Ese paciente ficticio confía en tu próxima respuesta.', '👶'],
    ['Risa clínica', 'Un pediatra feliz mide las dosis… y también sus descansos.', '🌈'],
    ['Constancia', 'Hoy una tarjeta, mañana una decisión clínica más clara.', '📚']
  ];
  const TOOLS = [
    ['Estetoscopio atento', 'Escuchar primero es una metodología clínica.', '🩺'],
    ['Oximetría precisa', 'Un número bien interpretado cambia la conversación.', '📟'],
    ['Algoritmo de bolsillo', 'Ordena pistas antes de pedir estudios.', '📋'],
    ['Ecografía aliada', 'La imagen correcta responde una pregunta concreta.', '🖥️'],
    ['Bitácora de guardia', 'Registrar bien es pensar dos veces.', '🗒️'],
    ['Calculadora pediátrica', 'Dosis, peso y doble verificación.', '⚖️']
  ];
  const LUXURY = [
    ['Estetoscopio dorado', 'Edición oro: escuchar con atención sigue siendo lo más valioso.', '✨'],
    ['Ecógrafo portátil elite', 'Una herramienta premium al servicio de una buena pregunta clínica.', '🔬']
  ];
  function cardFor(topic, number) {
    const rarity = number <= 12 ? 'common' : number <= 18 ? 'normal' : 'rare';
    const item = rarity === 'common' ? CHEER[number - 1] : rarity === 'normal' ? TOOLS[number - 13] : LUXURY[number - 19];
    return { id: `${topic}-${String(number).padStart(2, '0')}`, topic, number, rarity, title: item[0], message: item[1], emoji: item[2] };
  }
  function allCards() { return TOPICS.flatMap(topic => Array.from({ length: 20 }, (_, i) => cardFor(topic.id, i + 1))); }
  function socialProfile() { const p = profile(); return p && p.cloud?.userId ? p : null; }
  function statusText(error) { return error?.message || error || 'No fue posible completar esta acción.'; }
  function socialErrorMarkup() {
    return '<section class="panel"><h3>Conecta tu cuenta para usar la comunidad</h3><p style="margin-top:8px;color:var(--muted)">El ranking, el chat, los retos y las Ferchy Cards requieren una cuenta gratuita para proteger tu progreso e inventario.</p><button class="btn primary" data-go="achievements" style="margin-top:15px">Ver mi cuenta</button></section>';
  }
  function socialPage() {
    const p = socialProfile();
    if (!p) return '<section class="page-head"><span class="eyebrow">Comunidad</span><h1>Aprende en compañía</h1><p>Los espacios sociales son opcionales: el estudio individual sigue siendo gratuito.</p></section>' + socialErrorMarkup();
    const tab = state.socialTab || 'ranking';
    const content = state.socialLoading ? '<section class="panel"><p style="color:var(--muted)">Actualizando la comunidad…</p></section>' : (tab === 'ranking' ? rankingView() : tab === 'duels' ? duelsView() : tab === 'chat' ? chatView() : tab === 'friends' ? friendsView() : tab === 'profile' ? profileView() : albumView());
    return `<section class="page-head"><span class="eyebrow"><span class="online-dot"></span>Comunidad Rabanitos</span><h1>Aprende, reta y colecciona.</h1><p>Un ranking útil para orientarte, retos amistosos y Ferchy Cards para celebrar el hábito de estudio.</p></section><nav class="social-tabs" aria-label="Secciones de comunidad"><button data-social-tab="ranking" class="${tab === 'ranking' ? 'active' : ''}">Ranking</button><button data-social-tab="friends" class="${tab === 'friends' ? 'active' : ''}">Amigos</button><button data-social-tab="duels" class="${tab === 'duels' ? 'active' : ''}">Batallas VS</button><button data-social-tab="chat" class="${tab === 'chat' ? 'active' : ''}">Chat</button><button data-social-tab="album" class="${tab === 'album' ? 'active' : ''}">Álbum Ferchy</button><button data-social-tab="profile" class="${tab === 'profile' ? 'active' : ''}">Mi ficha</button></nav>${state.socialError ? `<p class="notice">${esc(state.socialError)}</p>` : ''}${content}`;
  }
  function rankingView() {
    const rows = state.social?.leaderboard || [];
    const duelTopic = state.duelTopic || TOPICS[0].id, scope = state.rankScope || 'all';
    const duelLevel = state.duelLevel || 'medio';
    return `<section class="panel"><div class="section-head" style="margin:0"><div><span class="eyebrow">Tablero semanal</span><h2>Ranking de estudio</h2><p>Ordenado por XP; las medallas y rachas hacen visible la constancia.</p></div><button class="btn ghost" id="refreshSocial">Actualizar</button></div><div class="social-tabs" style="margin-top:15px"><button data-rank-scope="all" class="${scope === 'all' ? 'active' : ''}">Comunidad</button><button data-rank-scope="friends" class="${scope === 'friends' ? 'active' : ''}">Solo amigos</button></div><div class="social-controls"><select id="duelTopic" aria-label="Tema del reto">${TOPICS.map(t => `<option value="${t.id}" ${t.id === duelTopic ? 'selected' : ''}>${esc(t.short)}</option>`).join('')}</select><select id="duelLevel" aria-label="Nivel del reto">${Object.entries(LEVELS).map(([id, level]) => `<option value="${id}" ${id === duelLevel ? 'selected' : ''}>${esc(level.name)}</option>`).join('')}</select><span class="tag">Reto: 10 preguntas · rapidez + precisión</span></div><div class="ranking-list">${rows.length ? rows.map((u, index) => rankingRow(u, index)).join('') : '<p class="social-empty">Aún no hay amigos en este tablero. Comparte tu código RAB para empezar.</p>'}</div></section>`;
  }
  function rankingRow(user, index) {
    const mine = user.id === socialProfile()?.cloud.userId;
    const friendship = user.relationship === 'friend' ? '<span class="metric-pill">Amigo</span>' : user.relationship === 'outgoing' ? '<span class="metric-pill">Solicitud enviada</span>' : user.relationship === 'incoming' ? `<button class="btn primary" data-respond-friend="${user.id}" data-friend-accept="true">Aceptar</button><button class="btn ghost" data-respond-friend="${user.id}" data-friend-accept="false">Rechazar</button>` : `<button class="btn ghost" data-request-friend="${esc(user.friend_code || '')}">Agregar</button>`;
    return `<article class="ranking-row"><span class="rank-number ${index < 3 ? 'top' : ''}">${user.rank || index + 1}</span><div class="rank-user"><i class="avatar">${esc(user.avatar || '🩺')}</i><div><h3>${esc(user.display_name || 'Residente')}</h3><p>${mine ? 'Tu perfil' : user.relationship === 'friend' ? 'Amigo de estudio' : 'Comunidad'}</p></div></div><div class="rank-metrics"><span class="metric-pill">${user.xp || 0} XP</span><span class="metric-pill">🔥 ${user.streak_current || 0}</span><span class="metric-pill">🏅 ${user.medals || 0}</span>${mine ? '' : friendship}${mine || user.relationship !== 'friend' ? '' : `<button class="btn ghost" data-challenge="${user.id}">Retar</button>`}</div></article>`;
  }
  function duelsView() {
    const duels = state.social?.duels || [];
    return `<section class="panel"><div class="section-head" style="margin:0"><div><span class="eyebrow">Batallas amistosas</span><h2>Modo VS</h2><p>Gana quien logra mejor puntaje; a igualdad de aciertos, decide el menor tiempo.</p></div><button class="btn ghost" id="refreshSocial">Actualizar</button></div>${duels.length ? `<div class="duel-list" style="margin-top:16px">${duels.map(duelRow).join('')}</div>` : '<p class="social-empty">Reta a alguien desde el ranking. Tu invitación aparecerá aquí.</p>'}</section>`;
  }
  function duelRow(d) {
    const p = socialProfile();
    const otherName = d.host_id === p.cloud.userId ? d.opponent_name : d.host_name;
    const isOpponent = d.opponent_id === p.cloud.userId;
    let action = '<span class="tag">Finalizada</span>';
    if (d.status === 'pending') action = isOpponent ? `<button class="btn primary" data-accept-duel="${d.id}">Aceptar reto</button>` : '<span class="tag">Esperando respuesta</span>';
    if (d.status === 'active') action = `<button class="btn primary" data-play-duel="${d.id}">Jugar ahora</button>`;
    const score = d.status === 'completed' ? `${d.host_name}: ${d.host_score ?? '—'} · ${d.opponent_name}: ${d.opponent_score ?? '—'}` : `${TOPICS.find(t => t.id === d.topic)?.short || d.topic} · ${LEVELS[d.level]?.name || d.level}`;
    return `<article class="duel-row"><span class="rank-number">⚔</span><div><h3>VS ${esc(otherName || 'residente')}</h3><p>${esc(score)}</p></div><div class="actions">${action}</div></article>`;
  }
  function friendsView() {
    const connections = state.social?.connections || [], friends = connections.filter(x => x.relationship === 'friend'), incoming = connections.filter(x => x.relationship === 'incoming'), outgoing = connections.filter(x => x.relationship === 'outgoing'), blocked = state.social?.blocked || [];
    const ownCode = profile().card?.friendCode || 'Generando…';
    const rows = (items, mode) => items.length ? items.map(person => friendRow(person, mode)).join('') : '<p class="social-empty">Nada por aquí todavía.</p>';
    return `<section class="panel"><span class="eyebrow">Tu código de amistad</span><h2 class="friend-code">${esc(ownCode)}</h2><p style="margin-top:7px;color:var(--muted)">Compártelo con quien quieras añadir. No contiene tu correo ni datos personales.</p><div class="social-controls"><input id="friendCodeInput" maxlength="10" placeholder="Ej. RAB-ABC123" aria-label="Código de amistad"><button class="btn primary" id="sendFriendRequest">Enviar solicitud</button></div></section><section class="panel"><div class="section-head" style="margin:0"><div><span class="eyebrow">Tu red</span><h2>${friends.length} amigo${friends.length === 1 ? '' : 's'} de estudio</h2></div><button class="btn ghost" id="refreshSocial">Actualizar</button></div><div class="duel-list" style="margin-top:14px">${rows(friends, 'friend')}</div></section><section class="panel"><h3>Solicitudes recibidas</h3><div class="duel-list" style="margin-top:12px">${rows(incoming, 'incoming')}</div>${outgoing.length ? `<p style="margin-top:13px;color:var(--muted);font-size:12px">${outgoing.length} solicitud${outgoing.length === 1 ? '' : 'es'} enviada${outgoing.length === 1 ? '' : 's'} esperando respuesta.</p>` : ''}</section><section class="panel"><h3>Cuentas bloqueadas</h3><p style="margin-top:5px;color:var(--muted);font-size:13px">Bloquear elimina la amistad y oculta toda interacción entre ambas cuentas.</p><div class="duel-list" style="margin-top:12px">${blocked.length ? blocked.map(person => `<article class="duel-row"><i class="avatar">${esc(person.avatar || '🩺')}</i><div><h3>${esc(person.display_name)}</h3><p>${esc(person.friend_code)}</p></div><div class="actions"><button class="btn ghost" data-unblock-user="${person.id}">Desbloquear</button></div></article>`).join('') : '<p class="social-empty">No has bloqueado a nadie.</p>'}</div></section>`;
  }
  function friendRow(person, mode) {
    const action = mode === 'incoming' ? `<button class="btn primary" data-respond-friend="${person.id}" data-friend-accept="true">Aceptar</button><button class="btn ghost" data-respond-friend="${person.id}" data-friend-accept="false">Rechazar</button>` : `<button class="btn ghost" data-remove-friend="${person.id}">Eliminar</button><button class="btn ghost" data-block-user="${person.id}">Bloquear</button>`;
    return `<article class="duel-row"><i class="avatar">${esc(person.avatar || '🩺')}</i><div><h3>${esc(person.display_name)}</h3><p>${esc(person.friend_code)}</p></div><div class="actions">${action}</div></article>`;
  }
  function profileView() {
    const p = profile(), card = p.card || {}, photo = card.photoUrl && /^https?:\/\//i.test(card.photoUrl) ? `<img class="profile-photo" src="${esc(card.photoUrl)}" alt="Foto de perfil de ${esc(p.name)}">` : `<i class="profile-photo avatar">${esc(p.avatar)}</i>`;
    return `<section class="identity-card"><div class="identity-header"><span>ACTA DE NACIMIENTO</span><b>RESIDENTE RABANITOS</b></div><div class="identity-main">${photo}<div><span class="eyebrow">Nombre clínico</span><h2>${esc(p.name)}</h2><p>${esc(card.bio || 'Aprendiendo pediatría, una pregunta a la vez.')}</p></div></div><div class="identity-grid"><span><b>Código</b>${esc(card.friendCode || 'Generando…')}</span><span><b>Especialidad</b>Pediatría</span><span><b>Miembro desde</b>${new Date(p.createdAt || Date.now()).toLocaleDateString()}</span></div></section><section class="panel"><span class="eyebrow">Editar mi ficha</span><h2>Tu tarjeta personal</h2><p style="margin-top:7px;color:var(--muted)">La foto es opcional y puedes usar una URL pública. Tu correo nunca se muestra aquí.</p><label class="field">Nombre visible<input id="profileName" maxlength="60" value="${esc(p.name)}"></label><label class="field">Foto de perfil (URL opcional)<input id="profilePhoto" type="url" maxlength="1000" value="${esc(card.photoUrl || '')}" placeholder="https://…"></label><label class="field">Una línea sobre ti<textarea id="profileBio" maxlength="180" placeholder="Ej. Residente de pediatría, amante del café y las guardias bien organizadas.">${esc(card.bio || '')}</textarea></label><button class="toe-print" id="saveProfileCard"><span>🦶</span><strong>Confirmar con la huellita del dedo gordo</strong><small>Es un botón divertido: no capturamos ni guardamos huellas, biometría ni información privada.</small></button>${state.profileSaved ? '<p class="notice" style="margin-top:12px">Ficha guardada. Tu información privada permanece privada.</p>' : ''}</section>`;
  }
  function chatView() {
    const messages = state.social?.messages || [];
    const me = socialProfile()?.cloud.userId;
    return `<section class="panel"><div class="section-head" style="margin:0"><div><span class="eyebrow">Sala de estudio</span><h2>Chat de comunidad</h2><p>Comparte dudas académicas con respeto. No uses este chat para urgencias ni información identificable de pacientes.</p></div><button class="btn ghost" id="refreshSocial">Actualizar</button></div><div class="chat-feed" id="chatFeed" aria-live="polite" style="margin-top:16px">${messages.length ? messages.map(m => `<article class="chat-message ${m.sender_id === me ? 'mine' : ''}"><header><span>${esc(m.sender_avatar || '🩺')} ${esc(m.sender_name || 'Residente')}</span><time>${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></header><p>${esc(m.body)}</p></article>`).join('') : '<p class="social-empty">Sé quien rompe el hielo con una pregunta de estudio.</p>'}</div><form class="chat-compose" id="chatForm"><input id="chatInput" maxlength="500" placeholder="Escribe un mensaje académico…" aria-label="Mensaje para la comunidad"><button class="btn primary" type="submit">Enviar</button></form></section>`;
  }
  function albumView() {
    const cards = state.social?.inventory || [];
    const topic = state.albumTopic || TOPICS[0].id;
    const inventory = new Map(cards.map(card => [card.id, card]));
    // El catálogo siempre contiene las 20 piezas del tema, incluso antes de que
    // el usuario haya desbloqueado alguna. Así la vista editorial no depende de
    // que la sincronización haya terminado de poblar el inventario.
    const own = allCards().filter(card => card.topic === topic).map(card => ({ ...card, ...(inventory.get(card.id) || {}), quantity: Number(inventory.get(card.id)?.quantity || 0) }));
    const collected = own.filter(card => card.quantity > 0).length;
    const duplicates = cards.filter(card => card.quantity > 1);
    const recipients = (state.social?.leaderboard || []).filter(u => u.id !== socialProfile().cloud.userId);
    const missing = cards.filter(card => !card.quantity);
    const canPreview = socialProfile()?.cloud?.role === 'admin';
    const preview = canPreview && !!state.albumPreview;
    const cardMarkup = own.map(card => ferchyCardMarkup(card, recipients, preview)).join('');
    const topicTabs = TOPICS.map(t => `<button class="${t.id === topic ? 'active' : ''}" data-album-topic="${t.id}">${esc(t.short)}</button>`).join('');
    const selectCard = items => items.map(c => `<option value="${c.id}">${esc(c.title)} · ${RARITY[c.rarity].label}</option>`).join('');
    const editorPreview = canPreview ? `<section class="art-preview-note"><div><span class="eyebrow">Galería editorial · Administrador</span><h3>${preview ? 'Todos los artes están visibles' : '¿Quieres revisar los artes?'}</h3><p>${preview ? 'Esta vista previa no desbloquea ni modifica tu inventario.' : 'Puedes revisar el diseño de las 20 cartas sin revelar ni modificar tu colección.'}</p></div><button class="btn ${preview ? 'ghost' : 'primary'}" id="toggleAlbumPreview">${preview ? 'Ocultar artes' : 'Ver todos los artes'}</button></section>` : '';
    return `<section class="panel"><div class="section-head" style="margin:0"><div><span class="eyebrow">Ferchy Cards</span><h2>Álbum de estudio</h2><p>Cada tema tiene 20 cartas: 12 comunes, 6 normales y 2 raras de arte dorado, disponibles solo en nivel alto.</p></div><button class="btn ghost" id="refreshSocial">Actualizar</button></div><div class="social-tabs" style="margin-top:16px">${topicTabs}</div><div class="album-summary"><article class="stat"><strong>${collected}/20</strong><span>cartas de este tema</span></article><article class="stat"><strong>${duplicates.reduce((n,c) => n + c.quantity - 1, 0)}</strong><span>repetidas para compartir</span></article><article class="stat"><strong>${cards.filter(c => c.rarity === 'rare' && c.quantity > 0).length}/10</strong><span>raras doradas</span></article></div>${editorPreview}<div class="card-grid ${preview ? 'art-showcase' : ''}">${cardMarkup}</div>${recipients.length && duplicates.length ? `<section class="panel" style="margin-top:18px"><h3>Intercambio amistoso</h3><p style="margin-top:6px;color:var(--muted);font-size:13px">Ofrece una repetida y solicita una carta que aún te falte. La otra persona decide si acepta.</p><div class="trade-grid"><label>Compañero<select id="tradeTarget">${recipients.map(u => `<option value="${u.id}">${esc(u.display_name)}</option>`).join('')}</select></label><label>Entregas<select id="tradeOffer">${selectCard(duplicates)}</select></label><label>Solicitas<select id="tradeRequest">${selectCard(missing.length ? missing : cards)}</select></label><button class="btn primary" id="offerTrade">Proponer</button></div>${tradeOffersMarkup()}</section>` : ''}${giftAndTradeInbox()}</section>`;
  }
  function cardArt(card) {
    const topic = TOPICS.find(item => item.id === card.topic) || TOPICS[0];
    return `<div class="card-art" aria-hidden="true"><span class="card-orbit orbit-a"></span><span class="card-orbit orbit-b"></span><b>${esc(topic.icon)}</b><i>${esc(card.emoji)}</i><small>Rabanitos</small></div>`;
  }
  function ferchyCardMarkup(card, recipients, preview = false) {
    const owned = card.quantity > 0;
    const revealed = owned || preview;
    const gift = owned && !preview && card.quantity > 1 && recipients.length ? `<button class="card-gift" data-gift-card="${card.id}">Regalar repetida</button>` : '';
    return `<article class="ferchy-card ${card.rarity} ${revealed ? '' : 'locked'}"><span class="rarity">${revealed ? (preview && !owned ? 'Vista de arte · ' : '') + RARITY[card.rarity].label : 'Por descubrir'}</span>${revealed ? `${cardArt(card)}<h3>${esc(card.title)}</h3><p>${esc(card.message)}</p>${owned ? `<span class="quantity">×${card.quantity}</span>` : ''}${gift}` : '<span class="card-emoji">?</span><h3>Ferchy Card</h3><p>Completa cuestionarios para revelar esta carta.</p>'}</article>`;
  }
  function giftAndTradeInbox() {
    const gifts = state.social?.gifts || [];
    const incomingTrades = (state.social?.trades || []).filter(t => t.status === 'pending' && t.recipient_id === socialProfile().cloud.userId);
    if (!gifts.length && !incomingTrades.length) return '';
    return `<section class="panel" style="margin-top:18px"><h3>Buzón de amistad</h3>${gifts.map(g => `<p style="margin-top:8px;color:var(--muted)">🎁 ${esc(g.sender_name)} te regaló <b>${esc(g.card_title)}</b>.</p>`).join('')}${incomingTrades.map(t => `<div class="duel-row" style="margin-top:10px"><div><h3>Intercambio de ${esc(t.sender_name)}</h3><p>Te ofrece ${esc(t.offered_title)} por ${esc(t.requested_title)}.</p></div><div class="actions"><button class="btn primary" data-accept-trade="${t.id}">Aceptar</button></div></div>`).join('')}</section>`;
  }
  function tradeOffersMarkup() {
    const sent = (state.social?.trades || []).filter(t => t.status === 'pending' && t.sender_id === socialProfile().cloud.userId);
    return sent.length ? `<p style="margin-top:12px;color:var(--muted);font-size:12px">${sent.length} intercambio${sent.length === 1 ? '' : 's'} esperando respuesta.</p>` : '';
  }
  async function loadSocial(force) {
    const p = socialProfile(), client = cloudClient();
    if (!p || !client || (state.socialLoading || (state.socialLoaded && !force))) return;
    state.socialLoading = true;
    const [leaderboard, duels, inventory, gifts, trades, connections, blocked, messages] = await Promise.all([
      client.rpc('get_leaderboard', { p_scope: state.rankScope || 'all' }), client.rpc('my_duels'), client.rpc('my_ferchy_inventory'), client.rpc('my_ferchy_gifts'), client.rpc('my_card_trades'), client.rpc('my_connections'), client.rpc('my_blocked_users'),
      client.from('chat_messages').select('id,sender_id,sender_name,sender_avatar,body,created_at').order('created_at', { ascending: true }).limit(50)
    ]);
    state.socialLoading = false;
    const responses = [leaderboard, duels, inventory, gifts, trades, connections, blocked, messages];
    const failure = responses.find(r => r.error);
    if (failure) { state.socialError = 'Activa las funciones sociales ejecutando el archivo db/schema.sql actualizado en Supabase. ' + statusText(failure.error); state.socialLoaded = true; render(); return; }
    state.social = { leaderboard: leaderboard.data || [], duels: duels.data || [], inventory: (inventory.data || []).map(hydrateCard), gifts: gifts.data || [], trades: trades.data || [], connections: connections.data || [], blocked: blocked.data || [], messages: messages.data || [] };
    const self = state.social.leaderboard.find(user => user.id === p.cloud.userId);
    if (self?.friend_code && p.card?.friendCode !== self.friend_code) { p.card.friendCode = self.friend_code; save(p); }
    state.socialError = '';
    state.socialLoaded = true;
    subscribeRealtime(client);
    render();
  }
  function hydrateCard(row) { return { ...cardFor(row.topic, row.card_number || row.number), quantity: Number(row.quantity || 0) }; }
  function subscribeRealtime(client) {
    if (window.__rabanitosRealtime) return;
    window.__rabanitosRealtime = client.channel('rabanitos-community')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        if (!state.social?.messages) return;
        state.social.messages = [...state.social.messages.slice(-49), payload.new];
        if (state.page === 'social' && state.socialTab === 'chat') render();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => { if (state.page === 'social') loadSocial(true); })
      .subscribe();
  }
  async function sendChat() {
    const input = document.querySelector('#chatInput'), body = input?.value.trim(), client = cloudClient();
    if (!body || !client) return;
    input.value = '';
    const { error } = await client.rpc('send_chat_message', { p_body: body });
    if (error) { state.socialError = statusText(error); render(); }
  }
  async function createDuel(targetId) {
    const client = cloudClient(); if (!client) return;
    const topic = document.querySelector('#duelTopic')?.value || state.duelTopic || TOPICS[0].id;
    const level = document.querySelector('#duelLevel')?.value || state.duelLevel || 'medio';
    const { error } = await client.rpc('create_duel', { p_opponent_id: targetId, p_topic: topic, p_level: level });
    if (error) { state.socialError = statusText(error); render(); return; }
    await loadSocial(true);
  }
  async function acceptDuel(id) { const { error } = await cloudClient().rpc('accept_duel', { p_duel_id: id }); if (error) { state.socialError = statusText(error); render(); return; } await loadSocial(true); }
  function playDuel(id) {
    const duel = (state.social?.duels || []).find(d => d.id === id); if (!duel || duel.status !== 'active') return;
    const questions = questionsFor(duel.topic, duel.level).sort(() => Math.random() - .5).slice(0, 10).map(materialize);
    state = { ...state, page: 'duelQuiz', topic: duel.topic, level: duel.level, duel: { id, startedAt: Date.now(), opponent: duel.host_id === socialProfile().cloud.userId ? duel.opponent_name : duel.host_name }, quiz: { questions, index: 0, answers: [], streak: 0, bestStreak: 0, revealed: false, learn: 'clave' } };
    render();
  }
  window.finishSocialDuel = async function () {
    const qz = state.quiz, correct = qz.questions.reduce((n, q, i) => n + (q.correcta === qz.answers[i]), 0), duration = Math.max(1000, Date.now() - state.duel.startedAt), client = cloudClient();
    const { error } = await client.rpc('submit_duel_result', { p_duel_id: state.duel.id, p_score: correct, p_duration_ms: duration });
    if (error) { state.socialError = statusText(error); state.page = 'social'; state.duel = null; render(); return; }
    state.duel = null; state.page = 'social'; state.socialLoaded = false; await loadSocial(true);
  };
  window.awardFerchyCard = async function (topic, level) {
    const client = cloudClient(); if (!client || !socialProfile()) return;
    const { data } = await client.rpc('award_ferchy_card', { p_topic: topic, p_level: level });
    if (data?.[0]) { state.latestCard = hydrateCard(data[0]); if (state.page === 'result') render(); }
  };
  async function giftCard(cardId) {
    const target = document.querySelector('#tradeTarget')?.value || (state.social?.leaderboard || []).find(u => u.id !== socialProfile().cloud.userId)?.id;
    if (!target) { state.socialError = 'Aún no hay otro usuario disponible para recibir un regalo.'; render(); return; }
    const { error } = await cloudClient().rpc('send_ferchy_gift', { p_card_id: cardId, p_recipient_id: target });
    if (error) { state.socialError = statusText(error); render(); return; }
    await loadSocial(true);
  }
  async function offerTrade() {
    const target = document.querySelector('#tradeTarget')?.value, offer = document.querySelector('#tradeOffer')?.value, request = document.querySelector('#tradeRequest')?.value;
    if (!target || !offer || !request || offer === request) { state.socialError = 'Elige un compañero y dos cartas distintas.'; render(); return; }
    const { error } = await cloudClient().rpc('offer_card_trade', { p_recipient_id: target, p_offered_card_id: offer, p_requested_card_id: request });
    if (error) { state.socialError = statusText(error); render(); return; }
    await loadSocial(true);
  }
  async function acceptTrade(id) { const { error } = await cloudClient().rpc('accept_card_trade', { p_trade_id: id }); if (error) { state.socialError = statusText(error); render(); return; } await loadSocial(true); }
  async function requestFriend(code) {
    const value = (code || document.querySelector('#friendCodeInput')?.value || '').trim();
    if (!value) { state.socialError = 'Escribe un código de amistad.'; render(); return; }
    const { error } = await cloudClient().rpc('send_friend_request', { p_friend_code: value });
    if (error) { state.socialError = statusText(error); render(); return; }
    state.socialError = ''; await loadSocial(true);
  }
  async function respondFriend(personId, accept) {
    const request = (state.social?.connections || []).find(x => x.id === personId && x.relationship === 'incoming');
    if (!request) return;
    const { error } = await cloudClient().rpc('respond_friend_request_for', { p_requester_id: personId, p_accept: accept });
    if (error) { state.socialError = statusText(error); render(); return; }
    await loadSocial(true);
  }
  async function removeFriend(id) { const { error } = await cloudClient().rpc('remove_friend', { p_friend_id: id }); if (error) { state.socialError = statusText(error); render(); return; } await loadSocial(true); }
  async function blockUser(id) { if (!confirm('¿Bloquear esta cuenta? Se eliminará la amistad y ya no podrán interactuar.')) return; const { error } = await cloudClient().rpc('block_user', { p_user_id: id }); if (error) { state.socialError = statusText(error); render(); return; } await loadSocial(true); }
  async function unblockUser(id) { const { error } = await cloudClient().rpc('unblock_user', { p_user_id: id }); if (error) { state.socialError = statusText(error); render(); return; } await loadSocial(true); }
  async function saveProfileCard() {
    const p = profile(), name = document.querySelector('#profileName')?.value.trim(), photoUrl = document.querySelector('#profilePhoto')?.value.trim() || '', bio = document.querySelector('#profileBio')?.value.trim() || '';
    if (!name || name.length < 2) { state.socialError = 'El nombre debe tener al menos 2 caracteres.'; render(); return; }
    if (photoUrl && !/^https?:\/\//i.test(photoUrl)) { state.socialError = 'La foto debe usar una URL que comience con https:// o http://.'; render(); return; }
    const { error } = await cloudClient().from('profiles').update({ display_name: name, photo_url: photoUrl, bio }).eq('id', p.cloud.userId);
    if (error) { state.socialError = statusText(error); render(); return; }
    p.name = name; p.card = { ...(p.card || {}), photoUrl, bio }; save(p); state.profileSaved = true; state.socialError = ''; render();
  }
  window.bindSocialExtras = function () {
    if (state.page === 'social' && !state.socialLoaded && !state.socialLoading) loadSocial(false);
    document.querySelectorAll('[data-social-tab]').forEach(button => button.onclick = () => { state.socialTab = button.dataset.socialTab; render(); });
    document.querySelectorAll('[data-rank-scope]').forEach(button => button.onclick = () => { state.rankScope = button.dataset.rankScope; state.socialLoaded = false; loadSocial(true); });
    document.querySelectorAll('[data-album-topic]').forEach(button => button.onclick = () => { state.albumTopic = button.dataset.albumTopic; render(); });
    const togglePreview = document.querySelector('#toggleAlbumPreview');
    if (togglePreview) togglePreview.onclick = () => { state.albumPreview = !state.albumPreview; render(); };
    document.querySelectorAll('[data-challenge]').forEach(button => button.onclick = () => createDuel(button.dataset.challenge));
    document.querySelectorAll('[data-accept-duel]').forEach(button => button.onclick = () => acceptDuel(button.dataset.acceptDuel));
    document.querySelectorAll('[data-play-duel]').forEach(button => button.onclick = () => playDuel(button.dataset.playDuel));
    document.querySelectorAll('[data-gift-card]').forEach(button => button.onclick = () => giftCard(button.dataset.giftCard));
    document.querySelectorAll('[data-accept-trade]').forEach(button => button.onclick = () => acceptTrade(button.dataset.acceptTrade));
    document.querySelectorAll('[data-request-friend]').forEach(button => button.onclick = () => requestFriend(button.dataset.requestFriend));
    document.querySelectorAll('[data-respond-friend]').forEach(button => button.onclick = () => respondFriend(button.dataset.respondFriend, button.dataset.friendAccept === 'true'));
    document.querySelectorAll('[data-remove-friend]').forEach(button => button.onclick = () => removeFriend(button.dataset.removeFriend));
    document.querySelectorAll('[data-block-user]').forEach(button => button.onclick = () => blockUser(button.dataset.blockUser));
    document.querySelectorAll('[data-unblock-user]').forEach(button => button.onclick = () => unblockUser(button.dataset.unblockUser));
    const refresh = document.querySelector('#refreshSocial'); if (refresh) refresh.onclick = () => loadSocial(true);
    const form = document.querySelector('#chatForm'); if (form) form.onsubmit = event => { event.preventDefault(); sendChat(); };
    const trade = document.querySelector('#offerTrade'); if (trade) trade.onclick = offerTrade;
    const friend = document.querySelector('#sendFriendRequest'); if (friend) friend.onclick = () => requestFriend();
    const profileButton = document.querySelector('#saveProfileCard'); if (profileButton) profileButton.onclick = saveProfileCard;
  };
  window.socialPage = socialPage;
})();
