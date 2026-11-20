"use strict";

const categories = {
  housing: {
    label: "ЖКХ",
    agency: "Министерство жилищно-коммунального хозяйства Амурской области",
    url: "https://gkh.amurobl.ru/",
    example: "Третий день нет горячей воды в доме. Объявлений об отключении не было.",
    sample: "г. Благовещенск, ул. Примерная, д. 12",
    question: "Укажите населённый пункт, улицу и номер дома, чтобы добавить адрес объекта в заявление.",
    field: "Адрес дома",
    identify: /жкх|управляющ|сантехн|батареи?|отоплен|водоснабж|горяч\p{L}*\s+вод|холодн\p{L}*\s+вод|(?:нет|не стало)\s+воды|труб[ауы]|подъ[её]зд|лифт|света в доме|электричеств|мусорн|протеч|канализац|крыша теч[её]т/iu,
    detail: /(?:г\.\s*[\p{L}-]+,\s*)?(?:ул\.|улица|проспект|пер\.|переулок)\s*[\p{L}\d -]{1,45}(?:,\s*(?:д\.\s*|дом\s*)?|\s+(?:д\.\s*|дом\s*)?)\d+[\p{L}\d/–-]*/iu,
    templates: [
      [/горяч\p{L}*\s+вод|холодн\p{L}*\s+вод|(?:нет|не стало)\s+воды|водоснабж/iu, "О нарушении водоснабжения", "Прошу проверить обстоятельства, сообщить причину перебоя и указать, когда ожидается восстановление подачи воды."],
      [/отоплен|батареи?/iu, "О проблеме с отоплением", "Прошу проверить работу системы отопления по указанному адресу и сообщить о мерах по устранению проблемы."]
    ],
    fallback: ["По вопросу жилищно-коммунального хозяйства", "Прошу рассмотреть описанную ситуацию и сообщить, какие меры можно принять для её решения."]
  },
  health: {
    label: "Медицина",
    agency: "Министерство здравоохранения Амурской области",
    url: "https://minzdrav.amurobl.ru/",
    example: "Не могу записаться к терапевту уже неделю. В расписании нет свободных талонов.",
    sample: "Поликлиника № 3, Благовещенск",
    question: "В какой поликлинике или больнице это произошло? Укажите название учреждения и населённый пункт.",
    field: "Медицинское учреждение",
    identify: /врач|поликлиник|терапевт|педиатр|стоматолог|больниц|медицин|здравоохран|лекарств|анализ\p{L}*\s+в\s+клиник/iu,
    detail: /(?:поликлиник[ауеи]|больниц[ауеи])\s*(?:№\s*\d+|«[^»\r\n]+»|"[^"\r\n]+")(?:,\s*(?:г\.\s*)?[\p{L}-]+)?/iu,
    templates: [
      [/записа[тл]|запись|талон|расписан/iu, "О доступности записи на приём", "Прошу проверить доступность записи в указанном учреждении и сообщить, как можно записаться на приём."]
    ],
    fallback: ["По вопросу оказания медицинской помощи", "Прошу рассмотреть описанную ситуацию и разъяснить порядок дальнейших действий."]
  },
  school: {
    label: "Образование",
    agency: "Министерство образования и науки Амурской области",
    url: "https://obr.amurobl.ru/",
    example: "Переехали и хотим перевести ребёнка в другую школу. Какие документы нужны и как узнать, есть ли место?",
    sample: "Школа № 7, Благовещенск",
    question: "Укажите школу или детский сад и населённый пункт. Если вы ещё выбираете учреждение, достаточно населённого пункта.",
    field: "Учреждение или населённый пункт",
    identify: /школ|образован|учител|учени|детск\p{L}*\s+сад|садик|детсад|гимнази|лице[йяе]|колледж|перв\p{L}*\s+класс/iu,
    detail: /(?:школ[ауеи]|детски[йе]\s+сад|гимнази[яию]|лице[йяе])\s*(?:№\s*\d+|«[^»\r\n]+»|"[^"\r\n]+")(?:,\s*(?:г\.\s*)?[\p{L}-]+)?/iu,
    templates: [
      [/перевест|перевод|зачисл|поступ|при[её]м\s+в\s+школ/iu, "О порядке перевода или зачисления", "Прошу разъяснить порядок подачи заявления, перечень необходимых документов и способ уточнить наличие свободных мест."]
    ],
    fallback: ["По вопросу образования", "Прошу рассмотреть описанную ситуацию и разъяснить порядок дальнейших действий."]
  }
};

const get = (id) => document.getElementById(id);
const requestForm = get("request-form");
const request = get("request");
const workspace = get("workspace");
const conversation = get("conversation");
const choices = get("choices");
const detailForm = get("detail-form");
const detail = get("detail");
const autofill = get("autofill");
const result = get("result");
const draft = get("draft-text");
const draftLabel = get("draft-label");
const copyStatus = get("copy-status");

let current;

function clean(text) {
  return text.replaceAll("\u2014", "–").trim();
}

function addMessage(author, message) {
  const bubble = document.createElement("p");
  const label = document.createElement("strong");
  bubble.className = author === "Вы" ? "message visitor" : "message";
  label.textContent = author;
  bubble.append(label, document.createTextNode(message));
  conversation.append(bubble);
}

function clearDialog() {
  conversation.replaceChildren();
  choices.replaceChildren();
  choices.hidden = true;
  detailForm.reset();
  detail.setCustomValidity("");
  detailForm.hidden = true;
  result.hidden = true;
  draft.value = "";
  copyStatus.textContent = "";
}

function reveal(element) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
}

function begin(text, exampleKey) {
  clearDialog();
  current = { text, category: null, isExample: Boolean(exampleKey) };
  workspace.hidden = false;
  addMessage("Вы", text);

  const matching = Object.values(categories).filter((category) => category.identify.test(text));
  if (exampleKey || matching.length === 1) {
    useCategory(exampleKey ? categories[exampleKey] : matching[0]);
  } else {
    const options = matching.length ? matching : Object.values(categories);
    const prompt = matching.length
      ? "В запросе есть несколько тем. Какое направление выбрать для этого заявления?"
      : "Не удалось уверенно определить тему. Если запрос относится к одному из этих направлений, выберите его.";
    addMessage("Помощник", prompt);
    for (const category of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button outline";
      button.textContent = category.label;
      button.addEventListener("click", () => {
        choices.hidden = true;
        addMessage("Вы", category.label);
        useCategory(category);
        (detailForm.hidden ? draftLabel : detail).focus({ preventScroll: true });
      });
      choices.append(button);
    }
    choices.hidden = false;
  }

  get("dialog-title").focus({ preventScroll: true });
  reveal(workspace);
}

function useCategory(category) {
  current.category = category;
  const found = current.text.match(category.detail)?.[0];
  if (found) {
    finish(found);
    return;
  }

  addMessage("Помощник", "Тема обращения – " + category.label + ". " + category.question);
  get("detail-label").textContent = category.field;
  detail.placeholder = current.isExample ? category.sample : category.field;
  autofill.hidden = !current.isExample;
  detailForm.hidden = false;
}

function finish(place) {
  const { category, text } = current;
  const template = category.templates.find(([pattern]) => pattern.test(text));
  const [subject, action] = template ? template.slice(1) : category.fallback;
  detailForm.hidden = true;
  const agencyLink = get("agency-link");
  agencyLink.href = category.url;
  get("agency-name").textContent = category.agency;
  draft.value = [
    "Кому – " + category.agency,
    "От кого – [ФИО заявителя]",
    "Контакт для ответа – [укажите в официальной форме]",
    "",
    "ЗАЯВЛЕНИЕ",
    subject,
    "",
    category.field + " – " + place,
    "Описание ситуации со слов заявителя – «" + text + "»",
    "",
    action
  ].join("\n");
  addMessage("Помощник", "Тема обращения – " + category.label + ". Черновик готов. Проверьте текст и сведения перед переходом на сайт ведомства.");
  result.hidden = false;
}

requestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = clean(request.value);
  if (!text) {
    request.setCustomValidity("Опишите проблему или выберите готовый пример.");
    request.reportValidity();
    return;
  }
  begin(text);
});
request.addEventListener("input", () => request.setCustomValidity(""));

for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    const key = button.dataset.example;
    request.setCustomValidity("");
    request.value = categories[key].example;
    begin(request.value, key);
  });
}

detailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const place = clean(detail.value);
  if (!place) {
    detail.setCustomValidity("Заполните поле, чтобы продолжить.");
    detail.reportValidity();
    return;
  }
  addMessage("Вы", place);
  finish(place);
  draftLabel.focus({ preventScroll: true });
  reveal(result);
});
detail.addEventListener("input", () => detail.setCustomValidity(""));
autofill.addEventListener("click", () => {
  detail.setCustomValidity("");
  detail.value = current.category.sample;
  detailForm.requestSubmit();
});
get("reset").addEventListener("click", () => {
  current = null;
  clearDialog();
  workspace.hidden = true;
  requestForm.reset();
  request.setCustomValidity("");
  request.focus();
});

get("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    copyStatus.textContent = "Текст скопирован.";
  } catch {
    draft.focus();
    draft.select();
    copyStatus.textContent = document.execCommand("copy")
      ? "Текст скопирован."
      : "Текст выделен. Скопируйте его через меню браузера или клавиатуру.";
  }
});

get("download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob(["\uFEFF", draft.value], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "Заявление.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

