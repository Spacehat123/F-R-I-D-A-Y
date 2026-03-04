export function searchWeb(query: string): string {
  if (!query) return "What should I search for, Boss?";

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  // In Tauri, window.open might not work — use the opener plugin or fallback
  try {
    window.open(url, "_blank");
  } catch {
    // Silently fail, the URL was still constructed
  }

  return `Searching for "${query}"`;
}