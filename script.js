const menuBtn = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const form = document.getElementById('quick-form');
const formNote = document.getElementById('form-note');

const CONTENT_MAP = {
  hero_title: document.getElementById('content-hero-title'),
  hero_lead: document.getElementById('content-hero-lead'),
  contacts_title: document.getElementById('content-contacts-title'),
  contacts_address: document.getElementById('content-contacts-address'),
  phone_1: document.getElementById('content-phone-1'),
  phone_2: document.getElementById('content-phone-2'),
  email: document.getElementById('content-email'),
  whatsapp_link: document.getElementById('content-whatsapp-link'),
};

if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuBtn.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    });
  });
}

async function loadPublicSiteContent() {
  try {
    const response = await fetch('http://localhost:3001/api/public/site-content');
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const content = data.content || {};

    if (CONTENT_MAP.hero_title && content.hero_title) CONTENT_MAP.hero_title.textContent = content.hero_title;
    if (CONTENT_MAP.hero_lead && content.hero_lead) CONTENT_MAP.hero_lead.textContent = content.hero_lead;
    if (CONTENT_MAP.contacts_title && content.contacts_title) CONTENT_MAP.contacts_title.textContent = content.contacts_title;
    if (CONTENT_MAP.contacts_address && content.contacts_address) CONTENT_MAP.contacts_address.textContent = content.contacts_address;

    if (CONTENT_MAP.phone_1 && content.phone_1) {
      CONTENT_MAP.phone_1.textContent = content.phone_1;
      CONTENT_MAP.phone_1.href = `tel:${content.phone_1.replace(/\s+/g, '')}`;
    }
    if (CONTENT_MAP.phone_2 && content.phone_2) {
      CONTENT_MAP.phone_2.textContent = content.phone_2;
      CONTENT_MAP.phone_2.href = `tel:${content.phone_2.replace(/\s+/g, '')}`;
    }
    if (CONTENT_MAP.email && content.email) {
      CONTENT_MAP.email.textContent = content.email;
      CONTENT_MAP.email.href = `mailto:${content.email}`;
    }
    if (CONTENT_MAP.whatsapp_link && content.whatsapp_link) {
      CONTENT_MAP.whatsapp_link.href = content.whatsapp_link;
    }
  } catch (_) {
    // Public site should continue to work even if admin API is unreachable.
  }
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name') || '').toString().trim();
    const phone = (data.get('phone') || '').toString().trim();
    const service = (data.get('service') || '').toString().trim();
    const apiUrl = form.dataset.apiUrl || 'http://localhost:3001/api/site-lead';
    const source = form.dataset.source || 'site_quick_form';
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!name || !phone || !service) {
      formNote.textContent = 'Пожалуйста, заполните имя, телефон и услугу.';
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      formNote.textContent = 'Отправляем заявку...';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          service,
          source,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      formNote.textContent = `${name || 'Спасибо'}! Заявка принята. Менеджер скоро свяжется с вами.`;
      form.reset();
    } catch (error) {
      formNote.textContent = 'Не удалось отправить заявку. Напишите в Telegram-бот или попробуйте позже.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
}

const revealItems = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => observer.observe(item));
loadPublicSiteContent();
