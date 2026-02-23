/* ═══════════════════════════════════════════
   Admin Dashboard Logic
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // Add your Google email(s) here to control admin access
  const ALLOWED_EMAILS = [
    'n.dorfman00@gmail.com'
  ];

  let allGuests = [];
  let allRsvps  = [];

  /* ── DOM ── */

  const authGate       = document.getElementById('authGate');
  const googleSignIn   = document.getElementById('googleSignIn');
  const authError      = document.getElementById('authError');
  const signOutBtn     = document.getElementById('signOutBtn');
  const dashboard      = document.getElementById('adminDashboard');
  const dashSignOut    = document.getElementById('dashSignOut');

  const refreshBtn     = document.getElementById('refreshBtn');
  const exportCsvBtn   = document.getElementById('exportCsvBtn');

  const statInvited    = document.getElementById('statInvited');
  const statAttending  = document.getElementById('statAttending');
  const statDeclined   = document.getElementById('statDeclined');
  const statPending    = document.getElementById('statPending');
  const statAdditional = document.getElementById('statAdditional');

  const rsvpTableBody  = document.getElementById('rsvpTableBody');
  const noRsvps        = document.getElementById('noRsvps');

  const tabs           = document.querySelectorAll('.tab');
  const tabRsvps       = document.getElementById('tabRsvps');
  const tabGuests      = document.getElementById('tabGuests');

  const groupsList     = document.getElementById('groupsList');
  const addGroupBtn    = document.getElementById('addGroupBtn');
  const groupModal     = document.getElementById('groupModal');
  const groupModalTitle = document.getElementById('groupModalTitle');
  const groupForm      = document.getElementById('groupForm');
  const groupIdInput   = document.getElementById('groupIdInput');
  const memberRows     = document.getElementById('memberRows');
  const addMemberRow   = document.getElementById('addMemberRow');
  const cancelGroup    = document.getElementById('cancelGroup');

  const deleteConfirm  = document.getElementById('deleteConfirm');
  const deleteMsg      = document.getElementById('deleteMsg');
  const cancelDelete   = document.getElementById('cancelDelete');
  const confirmDelete  = document.getElementById('confirmDelete');

  let editingGroupId   = null;
  let deleteCallback   = null;

  /* ── Auth ── */

  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.hidden = false;
  }

  function handleSignedIn(user) {
    const email = user.email.toLowerCase();
    if (ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      authGate.hidden = true;
      dashboard.hidden = false;
      loadData();
    } else {
      showAuthError('Access denied. ' + user.email + ' is not authorized.');
      signOutBtn.hidden = false;
      auth.signOut();
    }
  }

  // Check if already signed in
  auth.onAuthStateChanged(user => {
    if (user) handleSignedIn(user);
  });

  googleSignIn.addEventListener('click', async () => {
    authError.hidden = true;
    signOutBtn.hidden = true;
    try {
      const result = await auth.signInWithPopup(googleProvider);
      handleSignedIn(result.user);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        showAuthError('Sign-in failed: ' + e.message);
      }
    }
  });

  signOutBtn.addEventListener('click', () => {
    auth.signOut();
    signOutBtn.hidden = true;
    authError.hidden = true;
  });

  dashSignOut.addEventListener('click', () => {
    auth.signOut();
    dashboard.hidden = true;
    authGate.hidden = false;
    authError.hidden = true;
    signOutBtn.hidden = true;
  });

  /* ── Tabs ── */

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('tab--active'));
    t.classList.add('tab--active');
    const target = t.dataset.tab;
    tabRsvps.hidden  = target !== 'rsvps';
    tabGuests.hidden = target !== 'guests';
  }));

  /* ── Data Loading ── */

  refreshBtn.addEventListener('click', loadData);

  async function loadData() {
    try {
      const [gSnap, rSnap] = await Promise.all([
        db.collection('guests').get(),
        db.collection('rsvps').get()
      ]);

      allGuests = gSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      allRsvps  = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      renderStats();
      renderRsvpTable();
      renderGuestGroups();
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  /* ── Stats ── */

  function renderStats() {
    const rsvpMap = new Map(allRsvps.map(r => [r.id, r]));
    const groups = groupBy(allGuests, 'groupId');

    let attending = 0, declined = 0, pending = 0, additional = 0;

    for (const [gid, members] of Object.entries(groups)) {
      const rsvp = rsvpMap.get(gid);
      if (!rsvp) {
        pending += members.length;
        continue;
      }
      attending += (rsvp.attending || []).length;
      declined += (rsvp.declined || []).length;
      additional += (rsvp.additionalGuests || []).length;

      const respondedIds = new Set([...(rsvp.attending || []), ...(rsvp.declined || [])]);
      members.forEach(m => {
        if (!respondedIds.has(m.id)) pending++;
      });
    }

    statInvited.textContent    = allGuests.length;
    statAttending.textContent  = attending;
    statDeclined.textContent   = declined;
    statPending.textContent    = pending;
    statAdditional.textContent = additional;
  }

  /* ── RSVP Table ── */

  function renderRsvpTable() {
    rsvpTableBody.innerHTML = '';

    if (allRsvps.length === 0) {
      noRsvps.hidden = false;
      return;
    }
    noRsvps.hidden = true;

    const guestMap = new Map(allGuests.map(g => [g.id, g]));

    allRsvps
      .sort((a, b) => tsVal(b.updatedAt) - tsVal(a.updatedAt))
      .forEach(rsvp => {
        const tr = document.createElement('tr');

        const attendingNames = (rsvp.attending || []).map(id => {
          const g = guestMap.get(id);
          return g ? g.name : id;
        });
        const declinedNames = (rsvp.declined || []).map(id => {
          const g = guestMap.get(id);
          return g ? g.name : id;
        });

        const updated = rsvp.updatedAt
          ? new Date(rsvp.updatedAt.seconds * 1000).toLocaleString()
          : '—';

        tr.innerHTML = `
          <td><strong>${esc(rsvp.id)}</strong></td>
          <td>${esc(rsvp.respondentName || '—')}</td>
          <td>${attendingNames.map(esc).join(', ') || '—'}</td>
          <td>${declinedNames.map(esc).join(', ') || '—'}</td>
          <td>${(rsvp.additionalGuests || []).map(esc).join(', ') || '—'}</td>
          <td>${updated}</td>
        `;
        rsvpTableBody.appendChild(tr);
      });
  }

  /* ── Guest Management ── */

  function guestStatus(guestId, groupId) {
    const rsvpMap = new Map(allRsvps.map(r => [r.id, r]));
    const rsvp = rsvpMap.get(groupId);
    if (!rsvp) return 'pending';
    if ((rsvp.attending || []).includes(guestId)) return 'attending';
    if ((rsvp.declined || []).includes(guestId)) return 'declined';
    return 'pending';
  }

  function statusIndicator(status) {
    const icons = { attending: '\u2713', declined: '\u2717', pending: '\u2022' };
    return `<span class="status-dot status-dot--${status}" title="${status}">${icons[status]}</span>`;
  }

  function renderGuestGroups() {
    groupsList.innerHTML = '';
    const groups = groupBy(allGuests, 'groupId');
    const rsvpMap = new Map(allRsvps.map(r => [r.id, r]));

    for (const [gid, members] of Object.entries(groups)) {
      const card = document.createElement('div');
      card.className = 'group-card';
      const rsvp = rsvpMap.get(gid);

      let membersHtml = members.map(m => {
        const status = guestStatus(m.id, gid);
        return `
        <div class="group-card__member group-card__member--${status}">
          <span>
            ${statusIndicator(status)}
            ${esc(m.name)}
            <span class="group-card__aliases">${(m.aliases || []).map(esc).join(', ')}</span>
          </span>
          <button class="btn--icon" data-delete-guest="${m.id}" title="Remove guest">&times;</button>
        </div>
      `}).join('');

      const additionalHtml = rsvp && (rsvp.additionalGuests || []).length
        ? rsvp.additionalGuests.map(name => `
          <div class="group-card__member group-card__member--additional">
            <span>${statusIndicator('attending')} ${esc(name)} <span class="group-card__aliases">additional guest</span></span>
          </div>
        `).join('')
        : '';

      card.innerHTML = `
        <div class="group-card__header">
          <span class="group-card__id">${esc(gid)}</span>
          <div class="group-card__actions">
            <button class="btn btn--small" data-edit-group="${gid}">Edit</button>
          </div>
        </div>
        ${membersHtml}
        ${additionalHtml}
      `;

      card.querySelectorAll('[data-delete-guest]').forEach(btn => {
        btn.addEventListener('click', () => promptDeleteGuest(btn.dataset.deleteGuest));
      });

      card.querySelector('[data-edit-group]').addEventListener('click', () => openEditGroup(gid, members));

      groupsList.appendChild(card);
    }
  }

  /* ── Add / Edit Group ── */

  addGroupBtn.addEventListener('click', () => {
    editingGroupId = null;
    groupModalTitle.textContent = 'Add Group';
    groupIdInput.value = '';
    groupIdInput.disabled = false;
    memberRows.innerHTML = '';
    addMemberRowFn();
    groupModal.hidden = false;
  });

  function openEditGroup(gid, members) {
    editingGroupId = gid;
    groupModalTitle.textContent = 'Edit Group';
    groupIdInput.value = gid;
    groupIdInput.disabled = true;
    memberRows.innerHTML = '';
    members.forEach(m => addMemberRowFn(m.name, (m.aliases || []).join(', '), m.id));
    groupModal.hidden = false;
  }

  cancelGroup.addEventListener('click', () => { groupModal.hidden = true; });

  addMemberRow.addEventListener('click', () => addMemberRowFn());

  function addMemberRowFn(name, aliases, existingId) {
    const row = document.createElement('div');
    row.className = 'member-row';
    if (existingId) row.dataset.existingId = existingId;
    row.innerHTML = `
      <div>
        <label>Name</label>
        <input type="text" class="field member-name" value="${esc(name || '')}" required>
      </div>
      <div>
        <label>Aliases (comma-separated)</label>
        <input type="text" class="field member-aliases" value="${esc(aliases || '')}">
      </div>
      <button type="button" class="btn--icon remove-member" title="Remove">&times;</button>
    `;
    row.querySelector('.remove-member').addEventListener('click', () => row.remove());
    memberRows.appendChild(row);
  }

  groupForm.addEventListener('submit', async e => {
    e.preventDefault();
    const gid = groupIdInput.value.trim();
    if (!gid) return;

    const rows = memberRows.querySelectorAll('.member-row');
    const members = [];
    rows.forEach(row => {
      const name = row.querySelector('.member-name').value.trim();
      const aliasStr = row.querySelector('.member-aliases').value.trim();
      const aliases = aliasStr ? aliasStr.split(',').map(a => a.trim()).filter(Boolean) : [];
      const existingId = row.dataset.existingId || null;
      if (name) members.push({ name, aliases, existingId });
    });

    if (members.length === 0) return;

    try {
      const batch = db.batch();

      for (const m of members) {
        if (m.existingId) {
          const ref = db.collection('guests').doc(m.existingId);
          batch.update(ref, { name: m.name, aliases: m.aliases });
        } else {
          const ref = db.collection('guests').doc();
          batch.set(ref, {
            name: m.name,
            aliases: m.aliases,
            groupId: gid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      await batch.commit();
      groupModal.hidden = true;
      await loadData();
    } catch (e) {
      console.error('Save group failed:', e);
      alert('Failed to save. Check the console for details.');
    }
  });

  /* ── Delete Guest ── */

  function promptDeleteGuest(guestId) {
    const guest = allGuests.find(g => g.id === guestId);
    deleteMsg.textContent = `Delete "${guest ? guest.name : guestId}"?`;
    deleteConfirm.hidden = false;
    deleteCallback = async () => {
      try {
        await db.collection('guests').doc(guestId).delete();
        deleteConfirm.hidden = true;
        await loadData();
      } catch (e) {
        console.error('Delete failed:', e);
      }
    };
  }

  cancelDelete.addEventListener('click', () => { deleteConfirm.hidden = true; });
  confirmDelete.addEventListener('click', () => { if (deleteCallback) deleteCallback(); });

  /* ── CSV Export ── */

  exportCsvBtn.addEventListener('click', () => {
    const guestMap = new Map(allGuests.map(g => [g.id, g]));
    const rows = [['Group', 'Guest Name', 'Status', 'Respondent', 'Additional Guests', 'Updated']];

    const groups = groupBy(allGuests, 'groupId');
    const rsvpMap = new Map(allRsvps.map(r => [r.id, r]));

    for (const [gid, members] of Object.entries(groups)) {
      const rsvp = rsvpMap.get(gid);
      const respondent = rsvp ? (rsvp.respondentName || '') : '';
      const additional = rsvp ? (rsvp.additionalGuests || []).join('; ') : '';
      const updated = rsvp && rsvp.updatedAt
        ? new Date(rsvp.updatedAt.seconds * 1000).toLocaleString()
        : '';

      members.forEach(m => {
        let status = 'Pending';
        if (rsvp) {
          if ((rsvp.attending || []).includes(m.id)) status = 'Attending';
          else if ((rsvp.declined || []).includes(m.id)) status = 'Declined';
        }
        rows.push([gid, m.name, status, respondent, additional, updated]);
      });

      if (rsvp && (rsvp.additionalGuests || []).length) {
        rsvp.additionalGuests.forEach(name => {
          rows.push([gid, name, 'Attending (additional)', respondent, '', updated]);
        });
      }
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvp-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ── Utils ── */

  function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      (acc[item[key]] = acc[item[key]] || []).push(item);
      return acc;
    }, {});
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function tsVal(ts) {
    if (!ts) return 0;
    if (ts.seconds) return ts.seconds;
    return 0;
  }

})();
