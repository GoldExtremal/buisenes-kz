import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const TWO_GIS_REVIEWS_URL = "https://2gis.kz/astana/firm/70000001040136089/tab/reviews";
const TWO_GIS_FIRM_URL = "https://2gis.kz/astana/firm/70000001040136089";
const TWO_GIS_LOGO_URL = "https://2gis.kz/favicon.ico";
const YANDEX_LOGO_URL = "https://yandex.ru/favicon.ico";
const TELEGRAM_LOGO_URL = "https://telegram.org/favicon.ico";
const WHATSAPP_LOGO_URL = "https://cdn.simpleicons.org/whatsapp/25D366";
const OFFICE_COORDS = [51.164985, 71.439996];
const YANDEX_MAP_LINK = "https://yandex.ru/maps/?ll=71.439996%2C51.164985&z=16&pt=71.439996,51.164985,pm2rdm";
const YANDEX_MAP_EMBED_URL =
  "https://yandex.ru/map-widget/v1/?ll=71.439996%2C51.164985&z=16&pt=71.439996,51.164985,pm2rdm";
const REVIEWS_LIMIT = 7;

const SITE_CONTENT_DEFAULTS = {
  hero_title: "Запуск бизнеса, миграция и визовое сопровождение без бюрократического стресса",
  hero_lead:
    "Сопровождаем предпринимателей и иностранцев под ключ: от регистрации ТОО в Казахстане до оформления виз любой сложности, РВП и релокационных программ.",
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

const VISA_GEOGRAPHY = [
  "США",
  "Канада",
  "Шенгенские страны Европы",
  "Великобритания",
  "Австралия",
  "Страны Азии и другие направления",
];

const VISA_CATEGORIES = [
  "Туристические",
  "Деловые / бизнес-визы",
  "Гостевые",
  "Частные поездки",
  "Визы по приглашению",
  "Воссоединение семьи",
  "Иммиграционные и релокационные программы",
];

const VISA_APPROACH = [
  "Индивидуальный разбор ситуации клиента",
  "Грамотная подготовка пакета документов",
  "Актуальные требования консульств",
  "Сопровождение от консультации до получения визы",
];

function formatPhoneInput(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";

  const hasPlusSevenPrefix = rawValue.trim().startsWith("+7");
  let local = digits;

  // If the input already contains our visual "+7" prefix, remove it from digit payload.
  if (hasPlusSevenPrefix && local.startsWith("7")) {
    local = local.slice(1);
  }

  // If user enters +7 and then starts again with 7/8, treat it as duplicated prefix.
  if (hasPlusSevenPrefix && local.length > 0 && (local[0] === "7" || local[0] === "8")) {
    local = local.slice(1);
  }

  // Normalize full phone forms like 8XXXXXXXXXX / 7XXXXXXXXXX to local 10 digits.
  if (local.length === 11 && (local.startsWith("7") || local.startsWith("8"))) {
    local = local.slice(1);
  }

  local = local.slice(0, 10);
  if (!local) {
    return hasPlusSevenPrefix ? "+7 (" : "";
  }

  let result = "+7";
  if (local.length > 0) result += ` (${local.slice(0, 3)}`;
  if (local.length > 3) result += `) ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}

function normalizePhoneForSubmit(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return value.trim();
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", service: "" });
  const [formState, setFormState] = useState({ loading: false, note: "" });
  const [content, setContent] = useState(SITE_CONTENT_DEFAULTS);
  const [reviewsState, setReviewsState] = useState({ loading: true, items: [], updatedAt: null });
  const [expandedReviews, setExpandedReviews] = useState({});
  const [overflowReviews, setOverflowReviews] = useState({});
  const reviewsTrackRef = useRef(null);
  const reviewTextRefs = useRef(new Map());
  const headerRef = useRef(null);

  const mergedContent = useMemo(() => ({ ...SITE_CONTENT_DEFAULTS, ...content }), [content]);

  useEffect(() => {
    const revealItems = document.querySelectorAll(".reveal:not(.visible)");
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
  }, [reviewsState.loading, reviewsState.items.length]);

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

  useEffect(() => {
    async function load2gisReviews() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/reviews/2gis`);
        if (!response.ok) {
          setReviewsState({ loading: false, items: [], updatedAt: null });
          return;
        }
        const data = await response.json();
        setReviewsState({
          loading: false,
          items: Array.isArray(data?.reviews) ? data.reviews : [],
          updatedAt: data?.updatedAt || null,
        });
      } catch (_err) {
        setReviewsState({ loading: false, items: [], updatedAt: null });
      }
    }

    load2gisReviews();
  }, []);

  const reviewsUpdatedAt = useMemo(() => {
    if (!reviewsState.updatedAt) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
        new Date(reviewsState.updatedAt)
      );
    } catch (_err) {
      return "";
    }
  }, [reviewsState.updatedAt]);

  const visibleReviews = useMemo(
    () => (Array.isArray(reviewsState.items) ? reviewsState.items.slice(0, REVIEWS_LIMIT) : []),
    [reviewsState.items]
  );

  useEffect(() => {
    const next = {};
    for (const review of visibleReviews) {
      const el = reviewTextRefs.current.get(review.id);
      if (!el) continue;
      next[review.id] = el.scrollHeight > el.clientHeight + 1;
    }
    setOverflowReviews(next);
  }, [visibleReviews]);

  const setReviewTextRef = (id) => (node) => {
    if (node) reviewTextRefs.current.set(id, node);
    else reviewTextRefs.current.delete(id);
  };

  function toggleReview(id) {
    setExpandedReviews((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const scrollToHash = useCallback((hash) => {
    if (!hash || !hash.startsWith("#")) return;
    if (hash === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.querySelector(hash);
    if (!target) return;

    const headerHeight = headerRef.current?.offsetHeight || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 10;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  function onInternalNavClick(event) {
    const hash = event.currentTarget.getAttribute("href");
    if (!hash || !hash.startsWith("#")) return;
    event.preventDefault();
    scrollToHash(hash);
    setMenuOpen(false);
  }
  function scrollReviews(direction) {
    const track = reviewsTrackRef.current;
    if (!track) return;
    const offset = Math.max(260, Math.round(track.clientWidth * 0.8));
    track.scrollBy({ left: direction * offset, behavior: "smooth" });
  }

  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.requestAnimationFrame(() => {
      scrollToHash(window.location.hash);
    });
    return () => window.cancelAnimationFrame(id);
  }, [scrollToHash]);

  async function onSubmit(event) {
    event.preventDefault();

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const service = formData.service.trim();
    const normalizedPhone = normalizePhoneForSubmit(phone);

    if (!name || !phone || !service) {
      setFormState({ loading: false, note: "Пожалуйста, заполните имя, телефон и услугу." });
      return;
    }

    if (!/^\+7\d{10}$/.test(normalizedPhone)) {
      setFormState({
        loading: false,
        note: "Проверьте телефон: формат должен быть +7 (___) ___-__-__",
      });
      return;
    }

    setFormState({ loading: true, note: "Отправляем заявку..." });

    try {
      const response = await fetch(`${API_BASE_URL}/api/site-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: normalizedPhone,
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

      <header className="site-header" id="top" ref={headerRef}>
        <div className="container header-inner">
          <a className="brand" href="#top" onClick={onInternalNavClick}>
            <img className="brand-logo" src="/logo-bkz.svg" alt="Центр Бизнес и Миграционных Решений" />
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
            <a href="#services" onClick={onInternalNavClick}>
              Услуги
            </a>
            <a href="#visa-support" onClick={onInternalNavClick}>
              Визы
            </a>
            <a href="#process" onClick={onInternalNavClick}>
              Как работаем
            </a>
            <a href="#faq" onClick={onInternalNavClick}>
              FAQ
            </a>
            <a href="#map" onClick={onInternalNavClick}>
              Карта
            </a>
            <a href="#contacts" onClick={onInternalNavClick}>
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
            <a className="btn btn-small nav-call-btn" href="tel:+77023721518" onClick={() => setMenuOpen(false)}>
              <span className="nav-call-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path
                    fill="currentColor"
                    d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.31.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.19 2.45.56 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2Z"
                  />
                </svg>
              </span>
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
                <a className="hero-cta hero-cta-primary" href="#contacts" onClick={onInternalNavClick}>
                  <span className="hero-cta-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        fill="currentColor"
                        d="M3.4 11.6 20.8 4.4c.87-.36 1.73.5 1.37 1.37L15 23.2c-.33.8-1.44.9-1.92.17l-3.1-4.72-4.7-3.1c-.74-.49-.64-1.6.16-1.93Zm3.5 2.3 3.67 2.42 1.4 2.13 4.94-11.92L6.9 13.9Z"
                      />
                    </svg>
                  </span>
                  Оставить заявку
                </a>
                <a
                  className="hero-cta hero-cta-tg"
                  href="https://t.me/ADVENTURESTORY_bot?start=site_hero"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="hero-cta-icon" aria-hidden="true">
                    <img src={TELEGRAM_LOGO_URL} alt="" />
                  </span>
                  Telegram
                </a>
                <a
                  className="hero-cta hero-cta-wa"
                  href={mergedContent.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="hero-cta-icon" aria-hidden="true">
                    <img src={WHATSAPP_LOGO_URL} alt="" />
                  </span>
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
                    inputMode="tel"
                    maxLength={18}
                    onChange={(e) => setFormData((s) => ({ ...s, phone: formatPhoneInput(e.target.value) }))}
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

        <section className="visa-support" id="visa-support">
          <div className="container visa-grid">
            <article className="visa-card visa-intro reveal">
              <p className="eyebrow">Новое направление</p>
              <h2>Комплексное визовое сопровождение</h2>
              <p>
                Мы начали активно развивать направление визового сопровождения и берём в работу кейсы любой сложности:
                от частных поездок до иммиграционных и релокационных программ.
              </p>
              <div className="visa-children">
                <article className="visa-card visa-child reveal delay-1">
                  <h3>География работы</h3>
                  <ul className="visa-list">
                    {VISA_GEOGRAPHY.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="visa-card visa-child reveal delay-2">
                  <h3>Категории виз</h3>
                  <ul className="visa-list">
                    {VISA_CATEGORIES.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="visa-card visa-child reveal">
                  <h3>Наш подход</h3>
                  <ul className="visa-list visa-list-check">
                    {VISA_APPROACH.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <a className="btn visa-call-btn" href="tel:+77023721518">
                    Получить консультацию
                  </a>
                </article>
              </div>
            </article>
          </div>
        </section>

        <section className="process" id="process">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">Процесс и преимущества</p>
              <h2>Понятный маршрут работы и сильные стороны команды</h2>
            </div>
            <div className="process-layout">
              <ol className="process-timeline">
                <li className="process-step reveal">
                  <span className="process-step-index">01</span>
                  <div>
                    <h3>Диагностика</h3>
                    <p>Фиксируем вашу цель, сроки, статус документов и ограничения.</p>
                  </div>
                </li>
                <li className="process-step reveal delay-1">
                  <span className="process-step-index">02</span>
                  <div>
                    <h3>Стратегия</h3>
                    <p>Формируем персональный план и список нужных документов.</p>
                  </div>
                </li>
                <li className="process-step reveal delay-2">
                  <span className="process-step-index">03</span>
                  <div>
                    <h3>Сопровождение</h3>
                    <p>Берем на себя коммуникации, подготовку и контроль этапов.</p>
                  </div>
                </li>
                <li className="process-step reveal">
                  <span className="process-step-index">04</span>
                  <div>
                    <h3>Финиш</h3>
                    <p>Передаем готовый результат и рекомендации на следующий шаг.</p>
                  </div>
                </li>
              </ol>

              <div className="process-benefits reveal">
                <ul>
                  <li>
                    <strong>Корпоративное сопровождение</strong>
                    <span>Четкие процессы, прозрачная коммуникация и контроль сроков на каждом этапе.</span>
                  </li>
                  <li>
                    <strong>Фокус на Астану</strong>
                    <span>Локальная практика по документам, консульствам, банкам и миграционным процедурам в РК.</span>
                  </li>
                  <li>
                    <strong>Решения под ключ</strong>
                    <span>От первичной консультации и стратегии до подачи документов и финального результата.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">FAQ</p>
              <h2>Частые вопросы</h2>
            </div>
            <div className="faq-list">
              <article className="faq-row reveal">
                <h3>Сколько времени занимает регистрация компании?</h3>
                <p>
                  Зависит от типа бизнеса и пакета документов. Обычно базовые этапы закрываются в течение нескольких
                  рабочих дней.
                </p>
              </article>
              <article className="faq-row reveal delay-1">
                <h3>Можно ли пройти процесс удаленно?</h3>
                <p>Часть этапов можно организовать дистанционно. По обязательным личным процедурам заранее сообщаем требования.</p>
              </article>
              <article className="faq-row reveal delay-2">
                <h3>Работаете ли вы с нерезидентами РК?</h3>
                <p>Да, это одно из ключевых направлений: ИИН/БИН, банковские вопросы, виза и миграционное сопровождение.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="reviews" id="reviews">
          <div className="container">
            <div className="section-head reveal reviews-head">
              <div>
                <p className="eyebrow">Отзывы 2ГИС</p>
                <h2>Что о нас говорят клиенты</h2>
                {reviewsUpdatedAt ? <p className="reviews-meta">Обновлено: {reviewsUpdatedAt}</p> : null}
              </div>
              <div className="reviews-actions">
                <button
                  className="reviews-arrow"
                  type="button"
                  aria-label="Scroll reviews left"
                  onClick={() => scrollReviews(-1)}
                >
                  {"<"}
                </button>
                <button
                  className="reviews-arrow"
                  type="button"
                  aria-label="Scroll reviews right"
                  onClick={() => scrollReviews(1)}
                >
                  {">"}
                </button>
                <a
                  className="btn btn-ghost"
                  href={TWO_GIS_REVIEWS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Оставить отзыв в 2ГИС
                </a>
              </div>
            </div>

            {reviewsState.loading ? (
              <p className="reviews-empty reveal">Загружаем отзывы...</p>
            ) : visibleReviews.length > 0 ? (
              <div className="reviews-grid" ref={reviewsTrackRef}>
                {visibleReviews.map((review) => (
                  <article className="review-card reveal" key={review.id}>
                    <div className="review-head">
                      <strong>{review.author}</strong>
                      <span className="review-stars">
                        {"★".repeat(Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))))}
                        {"☆".repeat(5 - Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))))}
                      </span>
                    </div>
                    {review.createdAt ? (
                      <p className="review-date">
                        {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(
                          new Date(review.createdAt)
                        )}
                      </p>
                    ) : null}
                    <p
                      className={`review-text ${expandedReviews[review.id] ? "expanded" : ""}`}
                      ref={setReviewTextRef(review.id)}
                    >
                      {review.text}
                    </p>
                    <div className="review-actions-row">
                      {overflowReviews[review.id] ? (
                        <button className="review-toggle" type="button" onClick={() => toggleReview(review.id)}>
                          {expandedReviews[review.id] ? "Свернуть" : "Читать полностью"}
                        </button>
                      ) : null}
                      <a href={review.sourceUrl || TWO_GIS_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
                        Смотреть в 2ГИС
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="reviews-empty reveal">
                Пока не удалось загрузить отзывы. Вы можете открыть их напрямую в 2ГИС.
              </p>
            )}
          </div>
        </section>

        <section className="map-block" id="map">
          <div className="container map-layout reveal">
            <div className="map-frame">
              <iframe
                title="Карта офиса Business KZ (Яндекс Карты)"
                src={YANDEX_MAP_EMBED_URL}
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
                  className="btn map-btn map-btn-2gis"
                  href={TWO_GIS_FIRM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img className="map-btn-logo" src={TWO_GIS_LOGO_URL} alt="" aria-hidden="true" />
                  Открыть в 2ГИС
                </a>
                <a
                  className="btn map-btn map-btn-yandex"
                  href={YANDEX_MAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img className="map-btn-logo" src={YANDEX_LOGO_URL} alt="" aria-hidden="true" />
                  Открыть в Яндекс Картах
                </a>
                <a className="btn btn-ghost map-btn map-btn-call" href="tel:+77023721518">
                  <span className="map-btn-icon map-btn-icon-phone" aria-hidden="true">
                    ☎
                  </span>
                  Позвонить
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="contacts" id="contacts">
          <div className="container contacts-wrap reveal">
            <div className="contacts-panel">
              <div className="contacts-head">
                <p className="eyebrow">Контакты</p>
                <h2>{mergedContent.contacts_title}</h2>
                <p className="contacts-address">{mergedContent.contacts_address}</p>
              </div>

              <div className="contacts-hours">
                <p className="contacts-hours-label">Режим работы</p>
                <div className="hours-board">
                  <div className="hours-days-grid">
                    <span>ПН</span>
                    <span>ВТ</span>
                    <span>СР</span>
                    <span>ЧТ</span>
                    <span>ПТ</span>
                    <span className="is-weekend">СБ</span>
                    <span className="is-weekend">ВС</span>
                  </div>
                  <div className="hours-values-grid">
                    <strong className="hours-value is-open">09:00 - 18:30</strong>
                    <strong className="hours-value is-closed">Выходной</strong>
                  </div>
                </div>
              </div>

              <div className="contacts-links">
                <p className="contacts-links-title">Связаться с нами</p>
                <a className="contact-item" href={`tel:${mergedContent.phone_1.replace(/\s+/g, "")}`}>
                  <span className="contact-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        fill="currentColor"
                        d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.31.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.19 2.45.56 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2Z"
                      />
                    </svg>
                  </span>
                  <span>{mergedContent.phone_1}</span>
                </a>
                <a className="contact-item" href={`tel:${mergedContent.phone_2.replace(/\s+/g, "")}`}>
                  <span className="contact-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        fill="currentColor"
                        d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.31.56 3.57.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.19 2.45.56 3.57a1 1 0 0 1-.24 1.02l-2.2 2.2Z"
                      />
                    </svg>
                  </span>
                  <span>{mergedContent.phone_2}</span>
                </a>
                <a className="contact-item" href={`mailto:${mergedContent.email}`}>
                  <span className="contact-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        fill="currentColor"
                        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2 8 5 8-5H4Zm16 10V9l-8 5-8-5v8h16Z"
                      />
                    </svg>
                  </span>
                  <span>{mergedContent.email}</span>
                </a>
                <a className="contact-item" href={mergedContent.whatsapp_link} target="_blank" rel="noopener noreferrer">
                  <span className="contact-item-icon is-wa" aria-hidden="true">
                    <img src={WHATSAPP_LOGO_URL} alt="" />
                  </span>
                  <span>WhatsApp</span>
                </a>
                <a className="contact-item" href="https://t.me/migration_v_kz" target="_blank" rel="noopener noreferrer">
                  <span className="contact-item-icon is-tg" aria-hidden="true">
                    <img src={TELEGRAM_LOGO_URL} alt="" />
                  </span>
                  <span>Telegram</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>© Business KZ. Центр бизнес и миграционных решений</p>
          <a href="#top" onClick={onInternalNavClick}>Наверх</a>
        </div>
      </footer>

      <div className="floating-actions">
        <a
          className="float-btn float-btn-wa"
          href={mergedContent.whatsapp_link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть чат WhatsApp"
          title="WhatsApp"
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.51 0 .17 5.33.17 11.89c0 2.1.55 4.16 1.58 5.97L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.48h.01c6.55 0 11.9-5.33 11.9-11.89 0-3.17-1.23-6.15-3.45-8.46ZM12.07 21.8a9.85 9.85 0 0 1-5.03-1.38l-.36-.21-3.74.98.99-3.64-.23-.37a9.83 9.83 0 0 1 1.52-12.2 9.8 9.8 0 0 1 6.84-2.82c5.42 0 9.84 4.42 9.84 9.85a9.86 9.86 0 0 1-9.83 9.8Zm5.4-7.37c-.3-.15-1.76-.87-2.03-.97-.28-.1-.48-.15-.67.15-.2.3-.77.97-.95 1.16-.17.2-.35.22-.65.08-.3-.15-1.27-.47-2.41-1.5-.89-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.03 1-1.03 2.43 0 1.43 1.06 2.82 1.2 3.02.15.2 2.08 3.18 5.04 4.45.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.3.18-1.43-.08-.12-.27-.2-.57-.35Z"
            />
          </svg>
        </a>
        <a
          className="float-btn float-btn-tg"
          href="https://t.me/ADVENTURESTORY_bot?start=site_float"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть Telegram-бот"
          title="Telegram"
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20.95 4.58a1.23 1.23 0 0 0-1.27-.19L3.1 10.99a1.14 1.14 0 0 0 .08 2.16l3.82 1.26 1.54 4.91a1.15 1.15 0 0 0 2.06.23l2.28-3.08 3.83 2.79a1.24 1.24 0 0 0 1.94-.76l2.17-12.6a1.24 1.24 0 0 0-.27-1.06ZM9.23 14.03l8.61-6.24-7.07 7.8-.57 2.02-1-3.58Zm8.25 3.66-3.94-2.88a1.15 1.15 0 0 0-1.61.24l-.3.42.54-1.9 5.35-5.9-1.04 10.02Z"
            />
          </svg>
        </a>
      </div>
    </>
  );
}

export default App;






