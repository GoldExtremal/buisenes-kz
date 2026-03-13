const API = '/admin/api';
const TOKEN_KEY = 'bkz_admin_token';
const STATUSES = ['new', 'in_progress', 'waiting', 'done'];
const STATUS_LABELS = {
  new: 'Новые',
  in_progress: 'В работе',
  waiting: 'Ожидание',
  done: 'Готово',
};

const els = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  loginUsername: document.getElementById('login-username'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  meLine: document.getElementById('me-line'),
  refreshBtn: document.getElementById('refresh-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  stats: document.getElementById('stats'),
  kanban: document.getElementById('kanban'),
  contentForm: document.getElementById('content-form'),
  saveContentBtn: document.getElementById('save-content-btn'),
  contentStatus: document.getElementById('content-status'),
  usersPanel: document.getElementById('users-panel'),
  usersTable: document.getElementById('users-table'),
  createUserForm: document.getElementById('create-user-form'),
  newUsername: document.getElementById('new-username'),
  newPassword: document.getElementById('new-password'),
  newRole: document.getElementById('new-role'),
  activityPanel: document.getElementById('activity-panel'),
  activityList: document.getElementById('activity-list'),
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  me: null,
  users: [],
  leads: [],
  content: [],
};

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await response.json().catch(() => ({ ok: false }));
  if (!response.ok) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }
  return json;
}

function showLogin() {
  els.loginView.classList.remove('hidden');
  els.appView.classList.add('hidden');
}

function showApp() {
  els.loginView.classList.add('hidden');
  els.appView.classList.remove('hidden');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStats(stats) {
  const blocks = [
    { key: 'total', label: 'Всего', value: stats.total || 0 },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], value: stats.byStatus?.[s] || 0 })),
  ];

  els.stats.innerHTML = blocks
    .map((b) => `<div class="stat"><span>${b.label}</span><b>${b.value}</b></div>`)
    .join('');
}

function usersForAssign() {
  return state.users.filter((u) => Number(u.is_active) === 1);
}

function renderKanban() {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, []]));
  state.leads.forEach((lead) => {
    const status = STATUSES.includes(lead.status) ? lead.status : 'new';
    byStatus[status].push(lead);
  });

  els.kanban.innerHTML = STATUSES.map((status) => {
    const cards = byStatus[status]
      .map((lead) => {
        const assigneeOptions = ['<option value="">Без менеджера</option>']
          .concat(
            usersForAssign().map(
              (u) => `<option value="${u.id}" ${lead.assignee_user_id === u.id ? 'selected' : ''}>${escapeHtml(u.username)}</option>`
            )
          )
          .join('');

        return `
          <article class="lead-card" data-id="${lead.id}">
            <b>#${lead.id} ${escapeHtml(lead.name)}</b>
            <small>${escapeHtml(lead.phone)} | ${escapeHtml(lead.service)}</small>
            <small>${escapeHtml(lead.channel || '-')} | ${escapeHtml(lead.source || '-')}</small>
            <small>${escapeHtml(lead.created_at || '')}</small>
            <div class="controls">
              <input class="fld-name" value="${escapeHtml(lead.name)}" />
              <input class="fld-phone" value="${escapeHtml(lead.phone)}" />
              <input class="fld-service" value="${escapeHtml(lead.service)}" />
              <input class="fld-timing" value="${escapeHtml(lead.timing || '')}" placeholder="срок" />
              <textarea class="fld-comment" rows="2" placeholder="комментарий">${escapeHtml(lead.comment || '')}</textarea>
              <select class="fld-status">${STATUSES.map((s) => `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}</select>
              <select class="fld-assignee">${assigneeOptions}</select>
              <button class="save-btn">Сохранить</button>
            </div>
          </article>`;
      })
      .join('');

    return `<section class="column"><h4>${STATUS_LABELS[status]} (${byStatus[status].length})</h4>${cards}</section>`;
  }).join('');

  els.kanban.querySelectorAll('.save-btn').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const card = event.target.closest('.lead-card');
      const id = Number(card.dataset.id);
      const payload = {
        name: card.querySelector('.fld-name').value.trim(),
        phone: card.querySelector('.fld-phone').value.trim(),
        service: card.querySelector('.fld-service').value.trim(),
        timing: card.querySelector('.fld-timing').value.trim(),
        comment: card.querySelector('.fld-comment').value.trim(),
        status: card.querySelector('.fld-status').value,
        assignee_user_id: card.querySelector('.fld-assignee').value || null,
      };
      try {
        await api(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await loadData();
      } catch (err) {
        alert(`Ошибка сохранения: ${err.message}`);
      }
    });
  });
}

function renderContentForm() {
  const fields = [
    ['hero_title', 'Hero заголовок'],
    ['hero_lead', 'Hero описание'],
    ['contacts_title', 'Заголовок контактов'],
    ['contacts_address', 'Адрес'],
    ['phone_1', 'Телефон 1'],
    ['phone_2', 'Телефон 2'],
    ['email', 'Email'],
    ['whatsapp_link', 'WhatsApp ссылка'],
  ];

  const map = Object.fromEntries(state.content.map((row) => [row.key, row.value]));
  els.contentForm.innerHTML = fields
    .map(([key, label]) => {
      const isLong = key === 'hero_lead' || key === 'contacts_address';
      const input = isLong
        ? `<textarea data-key="${key}" rows="3">${escapeHtml(map[key] || '')}</textarea>`
        : `<input data-key="${key}" value="${escapeHtml(map[key] || '')}" />`;
      return `<label>${label}${input}</label>`;
    })
    .join('');
}

function renderUsers() {
  els.usersTable.innerHTML = `
    <table class="table">
      <thead><tr><th>ID</th><th>username</th><th>role</th><th>active</th><th>password</th><th>save</th></tr></thead>
      <tbody>
        ${state.users
          .map((u) => {
            return `<tr data-id="${u.id}">
              <td>${u.id}</td>
              <td>${escapeHtml(u.username)}</td>
              <td><select class="u-role"><option value="manager" ${u.role === 'manager' ? 'selected' : ''}>manager</option><option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>superadmin</option></select></td>
              <td><select class="u-active"><option value="1" ${Number(u.is_active) === 1 ? 'selected' : ''}>1</option><option value="0" ${Number(u.is_active) === 0 ? 'selected' : ''}>0</option></select></td>
              <td><input class="u-password" placeholder="новый пароль" /></td>
              <td><button class="u-save">Сохранить</button></td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  els.usersTable.querySelectorAll('.u-save').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      const row = event.target.closest('tr');
      const id = Number(row.dataset.id);
      const payload = {
        role: row.querySelector('.u-role').value,
        is_active: Number(row.querySelector('.u-active').value),
      };
      const pwd = row.querySelector('.u-password').value.trim();
      if (pwd) payload.password = pwd;
      try {
        await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await loadData();
      } catch (err) {
        alert(`Ошибка обновления пользователя: ${err.message}`);
      }
    });
  });
}

function renderActivity(logs) {
  els.activityList.innerHTML = logs
    .map((log) => `<div class="log-item"><b>${escapeHtml(log.created_at)}</b> | ${escapeHtml(log.actor_username || 'system')} | ${escapeHtml(log.action)}<br><small>${escapeHtml(log.details || '')}</small></div>`)
    .join('');
}

async function loadData() {
  const [statsResp, leadsResp, contentResp] = await Promise.all([
    api('/stats'),
    api('/leads'),
    api('/site-content'),
  ]);

  state.leads = leadsResp.leads || [];
  state.content = contentResp.content || [];

  if (state.me?.role === 'superadmin') {
    const [usersResp, activityResp] = await Promise.all([api('/users'), api('/activity')]);
    state.users = usersResp.users || [];
    renderUsers();
    renderActivity(activityResp.logs || []);
  }

  renderStats(statsResp);
  renderKanban();
  renderContentForm();
}

async function initAuth() {
  if (!state.token) {
    showLogin();
    return;
  }

  try {
    const meResp = await api('/me');
    state.me = meResp.user;
    els.meLine.textContent = `${state.me.username} (${state.me.role})`;
    if (state.me.role === 'superadmin') {
      els.usersPanel.classList.remove('hidden');
      els.activityPanel.classList.remove('hidden');
    }
    showApp();
    await loadData();
  } catch (_err) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = '';
    showLogin();
  }
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.textContent = '';

  try {
    const resp = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: els.loginUsername.value.trim(), password: els.loginPassword.value.trim() }),
    });
    state.token = resp.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    await initAuth();
  } catch (err) {
    els.loginError.textContent = 'Неверный логин или пароль.';
  }
});

els.logoutBtn.addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
  localStorage.removeItem(TOKEN_KEY);
  state.token = '';
  location.reload();
});

els.refreshBtn.addEventListener('click', async () => {
  await loadData();
});

els.saveContentBtn.addEventListener('click', async () => {
  const content = {};
  els.contentForm.querySelectorAll('[data-key]').forEach((input) => {
    content[input.dataset.key] = input.value.trim();
  });

  try {
    await api('/site-content', { method: 'PUT', body: JSON.stringify({ content }) });
    els.contentStatus.textContent = 'Сохранено';
    setTimeout(() => { els.contentStatus.textContent = ''; }, 2000);
  } catch (err) {
    els.contentStatus.textContent = `Ошибка: ${err.message}`;
  }
});

els.createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: els.newUsername.value.trim(),
        password: els.newPassword.value.trim(),
        role: els.newRole.value,
      }),
    });
    els.newUsername.value = '';
    els.newPassword.value = '';
    await loadData();
  } catch (err) {
    alert(`Ошибка создания пользователя: ${err.message}`);
  }
});

initAuth();
