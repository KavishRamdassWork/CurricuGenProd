export interface ParsedSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
}

/** Splits a slide markdown outline ("## Slide N: Title" headings) into
 *  structured slides. Non-list body lines under a heading become single
 *  bullets (flattened prose), matching how teachers actually write content. */
export function parseSlideMarkdown(markdown: string): ParsedSlide[] {
  const slideBlocks = markdown.split(/(?=^## Slide \d+:)/m).filter(b => b.trim());

  return slideBlocks.map(block => {
    const headingMatch = block.match(/^## Slide (\d+):\s*(.+)$/m);
    const slideNumber = headingMatch ? parseInt(headingMatch[1], 10) : 0;
    const title = headingMatch ? headingMatch[2].trim() : 'Untitled Slide';

    const body = block.replace(/^## Slide \d+:.+$/m, '').trim();
    const bullets = body
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { slideNumber, title, bullets };
  });
}
