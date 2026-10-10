const seen = new Set();

export function handleEvent(event, apply) {
  if (seen.has(event.id)) return false;
  seen.add(event.id);
  apply(event);
  return true;
}
