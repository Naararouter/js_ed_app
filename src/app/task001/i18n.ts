"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ru: {
    task001: {
      taskTitle: "Задание",
      hint: "Подсказка",
      reset: "Сбросить",
      check: "Проверить",
      addSelection: "Добавить текущую выделенную область",
      selectionInfo: "Выделите фрагмент в редакторе и нажмите «Добавить».",
      language: {
        label: "Язык",
        ru: "Рус",
        en: "Англ",
      },
      modes: {
        free: "Свободный режим",
        expressions: "Выражения",
        identifiers: "Идентификаторы",
        operators: "Операторы",
        keywords: "Ключевые слова",
        functionDefinitions: "Опред. функций",
        functionCalls: "Вызовы функций",
        objectKeys: "Ключи объекта",
        literals: "Литералы",
      },
      freeMode: {
        currentLabel: "Категория",
        coverage: "Покрытие",
        instructions:
          "В этом режиме нет подсказок: выделите весь код и присвойте каждому фрагменту подходящую категорию.",
        complete: "Отлично! Весь код покрыт выделениями.",
        partial: "Достигнут проходной порог.",
        incomplete: "Покройте весь код, чтобы завершить задачу.",
        categories: "Категории в покрытии",
        threshold: "Минимум для прохождения: {{value}}%",
      },
      tasks: {
        s1: "S1 — базовое",
        s2: "S2 — опциональный чейнинг",
        s3: "S3 — выражения в if",
        s4: "S4 — объекты и вычисляемые ключи",
        s5: "S5 — стрелки и IIFE",
        s6: "S6 — объект",
      },
      status: {
        title: "Панель статуса",
        groundTruth: "Эталонных выражений:",
        user: "Ваших отметок:",
        selections: "Ваши выделения",
        empty: "— ничего —",
        remove: "удалить",
      },
      tabs: {
        report: "Отчёт",
        details: "Детали",
      },
      recommendations: {
        title: "Рекомендации",
        item1:
          "Выбирайте режим выше — можно тренироваться на выражениях, идентификаторах, операторах, ключевых словах, определениях и вызовах функций, ключах объектов и литералах.",
        item2:
          "В свободном режиме вручную выберите категории, которые хотите проверять.",
        item3: "Подсказка добавляет следующее неотмеченное выражение.",
        item4:
          "Ловушка: <0>if (...) { ... }</0> — оператор, а не выражение; зато <1>doIt()</1> внутри — выражение.",
      },
      report: {
        title: "Результаты проверки",
        correct: "Верно",
        extra: "Лишние",
        missed: "Пропущены",
        score: "Счёт",
        scoreOutOf: "из возможных",
        noData: "Нажмите «Проверить», чтобы увидеть отчёт.",
      },
    },
  },
  en: {
    task001: {
      taskTitle: "Challenge",
      hint: "Hint",
      reset: "Reset",
      check: "Check",
      addSelection: "Add current selection",
      selectionInfo: "Select a fragment in the editor and click “Add”.",
      language: {
        label: "Language",
        ru: "RU",
        en: "EN",
      },
      modes: {
        free: "Free mode",
        expressions: "Expressions",
        identifiers: "Identifiers",
        operators: "Operators",
        keywords: "Keywords",
        functionDefinitions: "Function defs",
        functionCalls: "Function calls",
        objectKeys: "Object keys",
        literals: "Literals",
      },
      freeMode: {
        currentLabel: "Category",
        coverage: "Coverage",
        instructions:
          "No hints here: cover the whole snippet and tag every fragment with the right category.",
        complete: "Great! The entire snippet is covered.",
        partial: "Pass threshold reached.",
        incomplete: "Cover the whole snippet to finish the task.",
        categories: "Categories in coverage",
        threshold: "Pass threshold: {{value}}%",
      },
      tasks: {
        s1: "S1 — basics",
        s2: "S2 — optional chaining",
        s3: "S3 — expressions in if",
        s4: "S4 — objects & computed keys",
        s5: "S5 — arrows & IIFE",
        s6: "S6 — object",
      },
      status: {
        title: "Status panel",
        groundTruth: "Reference spans:",
        user: "Your selections:",
        selections: "Your highlights",
        empty: "— none —",
        remove: "remove",
      },
      tabs: {
        report: "Guide",
        details: "Details",
      },
      recommendations: {
        title: "Recommendations",
        item1:
          "Pick a mode above to practise expressions, identifiers, operators, keywords, function definitions and calls, object keys, or literals.",
        item2:
          "In free mode select which categories should count toward coverage.",
        item3: "The hint adds the next missing expression.",
        item4:
          "Watch out: <0>if (...) { ... }</0> is a statement, not an expression; but <1>doIt()</1> inside is an expression.",
      },
      report: {
        title: "Check results",
        correct: "Correct",
        extra: "Extra",
        missed: "Missed",
        score: "Score",
        scoreOutOf: "out of",
        noData: "Click “Check” to see the report.",
      },
    },
  },
};

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: "ru",
    fallbackLng: "ru",
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
