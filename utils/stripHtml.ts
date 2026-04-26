export function stripHtmlForPreview(html: string): string {
  if (!html) return ''

  return html
    // Replace @mention spans with just the name
    .replace(/<span[^>]*data-mention-name="([^"]*)"[^>]*>@[^<]*<\/span>/g, '@$1')
    // Replace <br> with a space
    .replace(/<br\s*\/?>/gi, ' ')
    // Strip any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}
