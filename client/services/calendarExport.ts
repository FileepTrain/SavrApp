// services/calendarExport.ts

type Recipe = {
  title?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

const toICSDate = (d: Date) =>
  d.getFullYear() +
  pad(d.getMonth() + 1) +
  pad(d.getDate()) +
  "T" +
  pad(d.getHours()) +
  pad(d.getMinutes()) +
  "00";

const buildDescription = (recipe: Recipe) => {
  if (!recipe) return "";
  return `Recipe: ${recipe.title ?? "Recipe"}`.replace(/\n/g, "\\n");
};

const createEvent = (date: Date, label: string, recipe?: Recipe) => {
  if (!recipe) return "";

  const hours: Record<string, number> = {
    Breakfast: 8,
    Lunch: 12,
    Dinner: 18,
  };

  const start = new Date(date);
  start.setHours(hours[label], 0, 0);

  const end = new Date(start);
  end.setHours(hours[label] + 1);

  return `
BEGIN:VEVENT
SUMMARY:${label}: ${recipe.title ?? "Recipe"}
DESCRIPTION:${buildDescription(recipe)}
DTSTART:${toICSDate(start)}
DTEND:${toICSDate(end)}
END:VEVENT`;
};

export const generateICS = async (days: {
  date: Date;
  breakfast: { title: string }[];
  lunch: { title: string }[];
  dinner: { title: string }[];
}[]) => {
  let events = "";

  const pad = (n: number) => String(n).padStart(2, "0");

  const toICSDate = (d: Date) =>
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00";

  const createEvent = (date: Date, label: string, title: string) => {
    const hours: Record<string, number> = {
      Breakfast: 8,
      Lunch: 12,
      Dinner: 18,
    };

    const start = new Date(date);
    start.setHours(hours[label], 0, 0);

    const end = new Date(start);
    end.setHours(hours[label] + 1);

    return `
BEGIN:VEVENT
SUMMARY:${label}: ${title}
DTSTART:${toICSDate(start)}
DTEND:${toICSDate(end)}
END:VEVENT`;
  };

  days.forEach((day) => {
    day.breakfast.forEach((r) => {
      events += createEvent(day.date, "Breakfast", r.title);
    });

    day.lunch.forEach((r) => {
      events += createEvent(day.date, "Lunch", r.title);
    });

    day.dinner.forEach((r) => {
      events += createEvent(day.date, "Dinner", r.title);
    });
  });

  return `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
${events}
END:VCALENDAR`;
};