const MENU_KEYBOARD = {
  keyboard: [
    ["Подобрать услугу", "Оставить заявку"],
    ["Связаться с менеджером", "О компании"],
  ],
  resize_keyboard: true,
};

const CANCEL_KEYBOARD = {
  keyboard: [["Отмена"]],
  resize_keyboard: true,
};

const SERVICES_KEYBOARD = {
  keyboard: [
    ["Регистрация ТОО/ИП", "Открытие счета"],
    ["Бизнес-виза", "ИИН/БИН"],
    ["РВП", "Юридический адрес"],
    ["Другое", "Отмена"],
  ],
  resize_keyboard: true,
};

const TIMING_KEYBOARD = {
  keyboard: [["Срочно (сегодня)", "1-3 рабочих дня"], ["На этой неделе", "Пока консультация"], ["Отмена"]],
  resize_keyboard: true,
};

const COMMENT_KEYBOARD = {
  keyboard: [["Без комментария"], ["Отмена"]],
  resize_keyboard: true,
};

const CONFIRM_KEYBOARD = {
  keyboard: [["Подтвердить", "Изменить"], ["Отмена"]],
  resize_keyboard: true,
};

const SOURCE_LABELS = {
  site_menu: "Сайт: меню",
  site_hero: "Сайт: hero",
  site_contacts: "Сайт: контакты",
  site_float: "Сайт: плавающая кнопка",
  site_quick_form: "Сайт: форма быстрой заявки",
};

const LEAD_STATUSES = ["new", "in_progress", "waiting", "done"];

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

const STEPS = {
  ASK_NAME: "ASK_NAME",
  ASK_PHONE: "ASK_PHONE",
  ASK_SERVICE: "ASK_SERVICE",
  ASK_TIMING: "ASK_TIMING",
  ASK_COMMENT: "ASK_COMMENT",
  ASK_CONFIRM: "ASK_CONFIRM",
};

module.exports = {
  MENU_KEYBOARD,
  CANCEL_KEYBOARD,
  SERVICES_KEYBOARD,
  TIMING_KEYBOARD,
  COMMENT_KEYBOARD,
  CONFIRM_KEYBOARD,
  SOURCE_LABELS,
  LEAD_STATUSES,
  SITE_CONTENT_DEFAULTS,
  STEPS,
};
