/* ═══════════════════════════════════════════
   RSVP Application Logic
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── State ── */

  let allGuests = [];            // fetched from Firestore
  let selectedGuest = null;      // the guest who searched
  let groupGuests = [];          // other guests in the same group
  let existingRsvp = null;       // existing RSVP doc for the group (if any)
  let additionalGuests = [];     // free-text additions

  /* ── DOM refs ── */

  const modal         = document.getElementById('rsvpModal');
  const backdrop      = document.getElementById('modalBackdrop');
  const closeBtn      = document.getElementById('modalClose');
  const openBtn       = document.getElementById('openRsvp');

  const step1         = document.getElementById('step1');
  const step2         = document.getElementById('step2');
  const step3         = document.getElementById('step3');
  const step4         = document.getElementById('step4');
  const stepLoading   = document.getElementById('stepLoading');
  const stepError     = document.getElementById('stepError');

  const nameForm      = document.getElementById('nameForm');
  const nameInput     = document.getElementById('nameInput');
  const nameError     = document.getElementById('nameError');
  const disambiguate  = document.getElementById('disambiguate');
  const disambiguateList = document.getElementById('disambiguateList');

  const checklistForm = document.getElementById('checklistForm');
  const guestChecklist = document.getElementById('guestChecklist');
  const groupLabel    = document.getElementById('groupLabel');
  const additionalInput = document.getElementById('additionalGuests');
  const addGuestBtn   = document.getElementById('addGuestBtn');
  const additionalList = document.getElementById('additionalList');
  const submitRsvpBtn = document.getElementById('submitRsvpBtn');
  const backToStep1   = document.getElementById('backToStep1');

  const confirmSummary = document.getElementById('confirmSummary');
  const backToStep2   = document.getElementById('backToStep2');
  const confirmBtn    = document.getElementById('confirmBtn');

  const successSummary = document.getElementById('successSummary');
  const restartRsvp   = document.getElementById('restartRsvp');
  const closeSuccess  = document.getElementById('closeSuccess');

  const errorMessage  = document.getElementById('errorMessage');
  const errorRetry    = document.getElementById('errorRetry');

  /* ── Boot ── */

  fetchGuests();
  bindEvents();

  async function fetchGuests() {
    try {
      const snap = await db.collection('guests').get();
      allGuests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('Failed to fetch guests:', e);
    }
  }

  /* ── Event Binding ── */

  function bindEvents() {
    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    nameForm.addEventListener('submit', handleNameSearch);
    checklistForm.addEventListener('submit', handleChecklistSubmit);
    addGuestBtn.addEventListener('click', handleAddGuest);
    additionalInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleAddGuest(); }
    });

    backToStep1.addEventListener('click', () => showStep(step1));
    backToStep2.addEventListener('click', () => showStep(step2));
    confirmBtn.addEventListener('click', handleConfirm);
    restartRsvp.addEventListener('click', e => { e.preventDefault(); resetFlow(); showStep(step1); });
    closeSuccess.addEventListener('click', closeModal);
    errorRetry.addEventListener('click', () => showStep(step1));
  }

  /* ── Modal helpers ── */

  function openModal() {
    resetFlow();
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => nameInput.focus(), 300);
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
  }

  function showStep(el) {
    [step1, step2, step3, step4, stepLoading, stepError].forEach(s => s.hidden = true);
    el.hidden = false;
  }

  function resetFlow() {
    selectedGuest = null;
    groupGuests = [];
    existingRsvp = null;
    additionalGuests = [];
    nameInput.value = '';
    nameError.hidden = true;
    disambiguate.hidden = true;
    additionalList.innerHTML = '';
    additionalInput.value = '';
    showStep(step1);
  }

  /* ── Step 1: Name Search ── */

  async function handleNameSearch(e) {
    e.preventDefault();
    nameError.hidden = true;
    disambiguate.hidden = true;

    const input = nameInput.value.trim();
    if (!input) return;

    if (allGuests.length === 0) {
      await fetchGuests();
    }

    const result = FuzzyMatch.search(input, allGuests);

    if (result.matches.length === 0) {
      nameError.textContent = "We couldn't find that name on our guest list. Please check the spelling and try again.";
      nameError.hidden = false;
      return;
    }

    if (result.matches.length === 1) {
      await selectGuest(result.matches[0]);
      return;
    }

    // Multiple matches — disambiguate
    disambiguateList.innerHTML = '';
    result.matches.forEach(g => {
      const li = document.createElement('li');
      li.textContent = g.name;
      li.addEventListener('click', () => selectGuest(g));
      disambiguateList.appendChild(li);
    });
    disambiguate.hidden = false;
  }

  async function selectGuest(guest) {
    selectedGuest = guest;

    // Find group members
    groupGuests = allGuests.filter(g => g.groupId === guest.groupId);

    // Check for existing RSVP
    try {
      const rsvpDoc = await db.collection('rsvps').doc(guest.groupId).get();
      existingRsvp = rsvpDoc.exists ? rsvpDoc.data() : null;
    } catch (e) {
      console.error('Error checking existing RSVP:', e);
      existingRsvp = null;
    }

    buildChecklist();
    showStep(step2);
  }

  /* ── Step 2: Checklist ── */

  function buildChecklist() {
    guestChecklist.innerHTML = '';
    additionalGuests = [];
    additionalList.innerHTML = '';
    additionalInput.value = '';

    if (existingRsvp) {
      submitRsvpBtn.textContent = 'Update RSVP';
      groupLabel.textContent = 'Update who will be attending:';
    } else {
      submitRsvpBtn.textContent = 'Submit RSVP';
      groupLabel.textContent = 'Select who will be attending:';
    }

    groupGuests.forEach(g => {
      const li = document.createElement('li');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'guest_' + g.id;
      cb.value = g.id;
      cb.dataset.name = g.name;

      // Pre-check logic: if existing RSVP, use its data; otherwise check all
      if (existingRsvp) {
        cb.checked = (existingRsvp.attending || []).includes(g.id);
      } else {
        cb.checked = true;
      }

      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.textContent = g.name;

      li.appendChild(cb);
      li.appendChild(label);
      guestChecklist.appendChild(li);
    });

    // Restore additional guests from existing RSVP
    if (existingRsvp && existingRsvp.additionalGuests) {
      existingRsvp.additionalGuests.forEach(name => addAdditionalGuest(name));
    }
  }

  function handleAddGuest() {
    const name = additionalInput.value.trim();
    if (!name) return;
    addAdditionalGuest(name);
    additionalInput.value = '';
    additionalInput.focus();
  }

  function addAdditionalGuest(name) {
    additionalGuests.push(name);
    renderAdditionalList();
  }

  function renderAdditionalList() {
    additionalList.innerHTML = '';
    additionalGuests.forEach((name, i) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = name;
      const btn = document.createElement('button');
      btn.className = 'remove-additional';
      btn.innerHTML = '&times;';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Remove ' + name);
      btn.addEventListener('click', () => {
        additionalGuests.splice(i, 1);
        renderAdditionalList();
      });
      li.appendChild(span);
      li.appendChild(btn);
      additionalList.appendChild(li);
    });
  }

  function handleChecklistSubmit(e) {
    e.preventDefault();
    buildSummary();
    showStep(step3);
  }

  /* ── Step 3: Confirm ── */

  function gatherRsvpData() {
    const checkboxes = guestChecklist.querySelectorAll('input[type="checkbox"]');
    const attending = [];
    const declined = [];

    checkboxes.forEach(cb => {
      if (cb.checked) {
        attending.push(cb.value);
      } else {
        declined.push(cb.value);
      }
    });

    return { attending, declined, additionalGuests: [...additionalGuests] };
  }

  function buildSummary() {
    const data = gatherRsvpData();
    let html = '';

    const attendingNames = data.attending.map(id => {
      const g = groupGuests.find(g => g.id === id);
      return g ? g.name : id;
    });
    const declinedNames = data.declined.map(id => {
      const g = groupGuests.find(g => g.id === id);
      return g ? g.name : id;
    });

    if (attendingNames.length) {
      html += '<h3>Attending</h3><ul class="attending-list">';
      attendingNames.forEach(n => html += '<li>' + escapeHtml(n) + '</li>');
      html += '</ul>';
    }

    if (declinedNames.length) {
      html += '<h3>Unable to Attend</h3><ul class="declined-list">';
      declinedNames.forEach(n => html += '<li>' + escapeHtml(n) + '</li>');
      html += '</ul>';
    }

    if (data.additionalGuests.length) {
      html += '<h3>Additional Guests</h3><ul class="additional-list">';
      data.additionalGuests.forEach(n => html += '<li>' + escapeHtml(n) + '</li>');
      html += '</ul>';
    }

    if (!attendingNames.length && !data.additionalGuests.length) {
      html += '<p style="text-align:center;color:var(--color-text-soft);">No attendees selected.</p>';
    }

    confirmSummary.innerHTML = html;
  }

  async function handleConfirm() {
    showStep(stepLoading);

    const data = gatherRsvpData();
    const rsvpDoc = {
      respondentName: selectedGuest.name,
      respondentGuestId: selectedGuest.id,
      attending: data.attending,
      declined: data.declined,
      additionalGuests: data.additionalGuests,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!existingRsvp) {
      rsvpDoc.submittedAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    try {
      await db.collection('rsvps').doc(selectedGuest.groupId).set(rsvpDoc, { merge: true });
      successSummary.innerHTML = confirmSummary.innerHTML;
      showStep(step4);
    } catch (e) {
      console.error('RSVP submission error:', e);
      errorMessage.textContent = 'Something went wrong submitting your RSVP. Please try again.';
      showStep(stepError);
    }
  }

  /* ── Util ── */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
