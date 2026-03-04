export function searchWeb(query: string) {

  if (!query) return "What should I search?"

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`

  window.open(url, "_blank")

  return `Searching for ${query}`

}