import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

const SITE_CONTENT_DEFAULTS = {
  hero_title: "Запуск бизнеса и легализация в Казахстане без бюрократического стресса",
  hero_lead:
    "Сопровождаем предпринимателей и иностранцев под ключ: от регистрации ТОО до оформления РВП и бизнес-визы.",
  contacts_title: "Обсудим вашу задачу",
  contacts_address: "Республика Казахстан, г. Астана, ул. Уалиханова, 5 офис 17",
  phone_1: "+7 702 372 15 18",
  phone_2: "+7 705 423 16 33",
  email: "info.cbr01@gmail.com",
  whatsapp_link: "https://wa.me/77023721518",
};

const SERVICES = [
  "Регистрация ТОО/ИП",
  "Открытие счета в банке",
  "Бизнес-виза",
  "ИИН/БИН",
  "РВП",
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", service: "" });
  const [formState, setFormState] = useState({ loading: false, note: "" });
  const [content, setContent] = useState(SITE_CONTENT_DEFAULTS);

  const mergedContent = useMemo(() => ({ ...SITE_CONTENT_DEFAULTS, ...content }), [content]);

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    async function loadPublicSiteContent() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/site-content`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.content && typeof data.content === "object") {
          setContent(data.content);
        }
      } catch (_err) {
        // Continue rendering static defaults when API is unavailable.
      }
    }

    loadPublicSiteContent();
  }, []);

  async function onSubmit(event) {
    event.preventDefault();

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const service = formData.service.trim();

    if (!name || !phone || !service) {
      setFormState({ loading: false, note: "Пожалуйста, заполните имя, телефон и услугу." });
      return;
    }

    setFormState({ loading: true, note: "Отправляем заявку..." });

    try {
      const response = await fetch(`${API_BASE_URL}/api/site-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          service,
          source: "site_quick_form_react",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setFormData({ name: "", phone: "", service: "" });
      setFormState({
        loading: false,
        note: `${name || "Спасибо"}! Заявка принята. Менеджер скоро свяжется с вами.`,
      });
    } catch (_err) {
      setFormState({
        loading: false,
        note: "Не удалось отправить заявку. Напишите в Telegram-бот или попробуйте позже.",
      });
    }
  }

  return (
    <>
      <div className="bg-shape bg-shape-1" />
      <div className="bg-shape bg-shape-2" />

      <header className="site-header" id="top">
        <div className="container header-inner">
          <a className="brand" href="#top">
            <span className="brand-mark">BKZ</span>
            <span className="brand-text">Business KZ</span>
          </a>

          <button
            className="menu-toggle"
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((s) => !s)}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`site-nav ${menuOpen ? "open" : ""}`} id="site-nav">
            <a href="#services" onClick={() => setMenuOpen(false)}>
              Услуги
            </a>
            <a href="#process" onClick={() => setMenuOpen(false)}>
              Как работаем
            </a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>
              FAQ
            </a>
            <a href="#map" onClick={() => setMenuOpen(false)}>
              Карта
            </a>
            <a href="#contacts" onClick={() => setMenuOpen(false)}>
              Контакты
            </a>
            <a
              href="https://t.me/ADVENTURESTORY_bot?start=site_menu"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              Бот Telegram
            </a>
            <a className="btn btn-small" href="tel:+77023721518" onClick={() => setMenuOpen(false)}>
              Позвонить
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-content reveal">
              <p className="eyebrow">Центр бизнес и миграционных решений</p>
              <h1>{mergedContent.hero_title}</h1>
              <p className="lead">{mergedContent.hero_lead}</p>
              <div className="hero-actions">
                <a className="btn" href="#contacts">
                  Оставить заявку
                </a>
                <a
                  className="btn"
                  href="https://t.me/ADVENTURESTORY_bot?start=site_hero"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Написать боту
                </a>
                <a className="btn btn-ghost" href={mergedContent.whatsapp_link} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </div>
              <ul className="metrics">
                <li>
                  <strong>1-3 дня</strong>
                  <span>на запуск ключевых процедур</span>
                </li>
                <li>
                  <strong>Астана</strong>
                  <span>локальная экспертиза по РК</span>
                </li>
                <li>
                  <strong>Под ключ</strong>
                  <span>документы, подача, контроль</span>
                </li>
              </ul>
            </div>

            <aside className="hero-card reveal delay-1">
              <h2>Быстрый старт</h2>
              <p>Оставьте контакт, и мы свяжемся с вами для бесплатного первичного разбора задачи.</p>
              <form className="quick-form" onSubmit={onSubmit}>
                <label>
                  Имя
                  <input
                    type="text"
                    name="name"
                    placeholder="Как к вам обращаться"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
                  />
                </label>
                <label>
                  Телефон
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+7 (___) ___-__-__"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData((s) => ({ ...s, phone: e.target.value }))}
                  />
                </label>
                <label>
                  Услуга
                  <select
                    name="service"
                    required
                    value={formData.service}
                    onChange={(e) => setFormData((s) => ({ ...s, service: e.target.value }))}
                  >
                    <option value="">Выберите направление</option>
                    {SERVICES.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" type="submit" disabled={formState.loading}>
                  {formState.loading ? "Отправка..." : "Отправить"}
                </button>
                <p className="form-note" aria-live="polite">
                  {formState.note}
                </p>
              </form>
            </aside>
          </div>
        </section>

        <section className="services" id="services">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Что делаем</p>
              <h2>Услуги для бизнеса и миграции</h2>
            </div>
            <div className="cards">
              <article className="card reveal">
                <h3>Регистрация компаний</h3>
                <p>Запуск ТОО/ИП, подготовка пакета документов, сопровождение до финального результата.</p>
              </article>
              <article className="card reveal delay-1">
                <h3>Открытие счета</h3>
                <p>Подготовим документы для банка и поможем пройти процедуру открытия расчетного счета.</p>
              </article>
              <article className="card reveal delay-2">
                <h3>Бизнес-виза C5</h3>
                <p>Консультация и сопровождение по визовым основаниям для ведения бизнеса в Казахстане.</p>
              </article>
              <article className="card reveal">
                <h3>Юридический адрес</h3>
                <p>Подберем и оформим юридический адрес для регистрации компании и рабочих процессов.</p>
              </article>
              <article className="card reveal delay-1">
                <h3>ИИН/БИН</h3>
                <p>Оформление идентификационных номеров для физических и юридических лиц-нерезидентов.</p>
              </article>
              <article className="card reveal delay-2">
                <h3>РВП и миграция</h3>
                <p>Сопровождение по разрешению на временное проживание и смежным миграционным вопросам.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="visual-strip" aria-label="Фотографии и атмосфера">
          <div className="container visual-grid">
            <article
              className="photo-tile reveal"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(8, 15, 26, 0.46), rgba(8, 15, 26, 0.64)), url('https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80')",
              }}
            >
              <h3>Корпоративное сопровождение</h3>
              <p>Четкие процессы и контроль сроков на каждом этапе.</p>
            </article>
            <article
              className="photo-tile reveal delay-1"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(8, 15, 26, 0.46), rgba(8, 15, 26, 0.64)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80')",
              }}
            >
              <h3>Фокус на Астану</h3>
              <p>Локальная практика по документам, банкам и миграции.</p>
            </article>
            <article
              className="photo-tile reveal delay-2"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(8, 15, 26, 0.46), rgba(8, 15, 26, 0.64)), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80')",
              }}
            >
              <h3>Решения под ключ</h3>
              <p>От первичной заявки до полного финального результата.</p>
            </article>
          </div>
        </section>

        <section className="process" id="process">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Процесс</p>
              <h2>Понятный маршрут от заявки до результата</h2>
            </div>
            <ol className="steps">
              <li className="reveal">
                <span>01</span>
                <h3>Диагностика</h3>
                <p>Фиксируем вашу цель, сроки, статус документов и ограничения.</p>
              </li>
              <li className="reveal delay-1">
                <span>02</span>
                <h3>Стратегия</h3>
                <p>Формируем персональный план и список нужных документов.</p>
              </li>
              <li className="reveal delay-2">
                <span>03</span>
                <h3>Сопровождение</h3>
                <p>Берем на себя коммуникации, подготовку и контроль этапов.</p>
              </li>
              <li className="reveal">
                <span>04</span>
                <h3>Финиш</h3>
                <p>Передаем готовый результат и рекомендации на следующий шаг.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">FAQ</p>
              <h2>Частые вопросы</h2>
            </div>
            <div className="faq-list">
              <details className="reveal">
                <summary>Сколько времени занимает регистрация компании?</summary>
                <p>
                  Зависит от типа бизнеса и пакета документов. Обычно базовые этапы закрываются в течение нескольких
                  рабочих дней.
                </p>
              </details>
              <details className="reveal delay-1">
                <summary>Можно ли пройти процесс удаленно?</summary>
                <p>Часть этапов можно организовать дистанционно. По обязательным личным процедурам заранее сообщаем требования.</p>
              </details>
              <details className="reveal delay-2">
                <summary>Работаете ли вы с нерезидентами РК?</summary>
                <p>Да, это одно из ключевых направлений: ИИН/БИН, банковские вопросы, виза и миграционное сопровождение.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="map-block" id="map">
          <div className="container map-layout reveal">
            <div className="map-frame">
              <iframe
                title="Карта офиса Business KZ"
                src="https://www.openstreetmap.org/export/embed.html?bbox=71.4299%2C51.1599%2C71.4501%2C51.1701&layer=mapnik&marker=51.164985%2C71.439996"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <aside className="map-info">
              <p className="eyebrow">Наш офис</p>
              <h2>Адрес и ориентир</h2>
              <p>Республика Казахстан, г. Астана, ул. Уалиханова, 5, офис 17</p>
              <p className="map-note">Координаты: 51.164985, 71.439996</p>
              <div className="map-actions">
                <a
                  className="btn"
                  href="https://www.openstreetmap.org/?mlat=51.164985&mlon=71.439996#map=16/51.164985/71.439996"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть карту
                </a>
                <a className="btn btn-ghost" href="tel:+77023721518">
                  Позвонить
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="contacts" id="contacts">
          <div className="container contacts-grid reveal">
            <div>
              <p className="eyebrow">Контакты</p>
              <h2>{mergedContent.contacts_title}</h2>
              <p>{mergedContent.contacts_address}</p>
            </div>
            <div className="contact-list">
              <a href={`tel:${mergedContent.phone_1.replace(/\s+/g, "")}`}>{mergedContent.phone_1}</a>
              <a href={`tel:${mergedContent.phone_2.replace(/\s+/g, "")}`}>{mergedContent.phone_2}</a>
              <a href={`mailto:${mergedContent.email}`}>{mergedContent.email}</a>
              <a href="https://t.me/ADVENTURESTORY_bot?start=site_contacts" target="_blank" rel="noopener noreferrer">
                Перейти в Telegram-бот
              </a>
              <a href="https://t.me/migration_v_kz" target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>© Business KZ. Центр бизнес и миграционных решений</p>
          <a href="#top">Наверх</a>
        </div>
      </footer>

      <a
        className="tg-float"
        href="https://t.me/ADVENTURESTORY_bot?start=site_float"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть Telegram-бот"
      >
        Telegram-бот
      </a>
    </>
  );
}

export default App;
