export const formatRelativeDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));

export const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");
