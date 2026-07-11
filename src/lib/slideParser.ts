export interface ParsedSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
}

/** Splits a slide markdown outline ("## Slide N: Title" headings) into
 *  structured slides. Each slide's AI-generated body follows a fixed
 *  "### Content / ### Speaker Notes / ### Suggested Visual" structure
 *  (see the presentation prompt in aiService.ts) — only the "### Content"
 *  section becomes slide bullets; speaker notes and visual-suggestion
 *  text are teacher-facing planning notes and are intentionally excluded
 *  from the exported deck. Non-list lines within "### Content" become
 *  single bullets (flattened prose), matching how teachers actually
 *  write content. */
export function parseSlideMarkdown(markdown: string): ParsedSlide[] {
  const slideBlocks = markdown.split(/(?=^## Slide \d+:)/m).filter(b => b.trim());

  return slideBlocks.map(block => {
    const headingMatch = block.match(/^## Slide (\d+):\s*(.+)$/m);
    const slideNumber = headingMatch ? parseInt(headingMatch[1], 10) : 0;
    const title = headingMatch ? headingMatch[2].trim() : 'Untitled Slide';

    const bodyWithoutHeading = block.replace(/^## Slide \d+:.+$/m, '');
    const subsections = bodyWithoutHeading.split(/(?=^### )/m);
    const contentSection = subsections.find(s => /^### Content\b/.test(s.trim()));
    const contentBody = (contentSection ? contentSection.replace(/^### Content\s*\n?/, '') : bodyWithoutHeading).trim();
    const bullets = contentBody
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { slideNumber, title, bullets };
  });
}
