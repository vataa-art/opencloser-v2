// Typed runtime copy of knowledge/recruitment/precall-cheatsheet.json.

export interface CheatSheetFact {
  id: string;
  title: string;
  detail: string;
}

export const PRECALL_CHEATSHEET_FACTS: CheatSheetFact[] = [
  { id: "who_and_source", title: "Хто дзвонить", detail: "ім'я + звідки заявка" },
  { id: "course_of_interest", title: "Курс інтересу", detail: "курс, яким цікавився кандидат" },
  { id: "price_and_start", title: "Ціна і старт", detail: "ціна і найближчий старт" },
  { id: "likely_objections", title: "Ймовірні заперечення", detail: "3 найімовірніші заперечення для цього сегмента" },
  { id: "previous_contact", title: "Попередній контакт", detail: "підсумок попереднього контакту одним рядком" },
];
