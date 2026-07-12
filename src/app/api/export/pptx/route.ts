// src/app/api/export/pptx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import PptxGenJS from 'pptxgenjs';
import { parseSlideMarkdown } from '@/lib/slideParser';
import buildRateLimit from '@/lib/rateLimit';

const exportLimiter = buildRateLimit({ uniqueTokenPerInterval: 500, interval: 60000 });

interface ExportPptxBody {
  slidesMarkdown: string;
  slideImages: { slideNumber: number; imageUrl: string }[];
  title: string;
  metadata: {
    subject?: string;
    grade?: string;
    schoolName?: string;
    logo?: string | null; // base64 data URI
  };
}

const COLORS = {
  title: '0F172A',
  bullet: '334155',
  accent: '2563EB',
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 20 exports per minute per user
    await exportLimiter.check(20, userId);
  } catch {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  let body: ExportPptxBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { slidesMarkdown, slideImages, title, metadata } = body;

  if (!slidesMarkdown || typeof slidesMarkdown !== 'string' || slidesMarkdown.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty slide content' }, { status: 400 });
  }

  try {
    const pres = new PptxGenJS();
    pres.defineLayout({ name: 'WIDESCREEN', width: 10, height: 5.63 });
    pres.layout = 'WIDESCREEN';

    // ── Title slide ──────────────────────────────────────────────
    const titleSlide = pres.addSlide();
    if (metadata.logo) {
      titleSlide.addImage({ data: metadata.logo, x: 0.4, y: 0.4, w: 0.9, h: 0.9 });
    }
    if (metadata.schoolName) {
      titleSlide.addText(metadata.schoolName, {
        x: 0.4, y: 1.5, w: 9.2, h: 0.4,
        fontSize: 14, color: COLORS.accent, bold: true, align: 'center',
      });
    }
    titleSlide.addText(title, {
      x: 0.4, y: 2.0, w: 9.2, h: 1.0,
      fontSize: 32, color: COLORS.title, bold: true, align: 'center',
    });
    const subtitleParts = [metadata.subject, metadata.grade].filter(Boolean);
    if (subtitleParts.length > 0) {
      titleSlide.addText(subtitleParts.join(' • '), {
        x: 0.4, y: 3.0, w: 9.2, h: 0.5,
        fontSize: 16, color: COLORS.bullet, align: 'center',
      });
    }

    // ── Content slides ───────────────────────────────────────────
    const parsedSlides = parseSlideMarkdown(slidesMarkdown);
    const imageBySlideNumber = new Map(slideImages.map(img => [img.slideNumber, img.imageUrl]));

    for (const slide of parsedSlides) {
      const s = pres.addSlide();
      const image = imageBySlideNumber.get(slide.slideNumber);

      if (image) {
        // Layout A: text left (~55%), image right (~45%)
        s.addText(slide.title, {
          x: 0.4, y: 0.4, w: 5.2, h: 0.8,
          fontSize: 24, color: COLORS.title, bold: true,
        });
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true, breakLine: true } })), {
          x: 0.4, y: 1.3, w: 5.2, h: 3.8,
          fontSize: 14, color: COLORS.bullet, valign: 'top',
        });
        s.addImage({ data: image, x: 5.9, y: 0.4, w: 3.7, h: 4.7, sizing: { type: 'contain', w: 3.7, h: 4.7 } });
      } else {
        // Text-only: centered title + bullets
        s.addText(slide.title, {
          x: 0.6, y: 0.5, w: 8.8, h: 0.8,
          fontSize: 26, color: COLORS.title, bold: true, align: 'center',
        });
        s.addText(slide.bullets.map(b => ({ text: b, options: { bullet: true, breakLine: true } })), {
          x: 1.2, y: 1.5, w: 7.6, h: 3.5,
          fontSize: 16, color: COLORS.bullet, valign: 'top',
        });
      }
    }

    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;

    const safeTitle = title
      .replace(/[\r\n]/g, '')
      .replace(/[^\w \-–—]/g, '')
      .trim() || 'slides';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.pptx"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('PPTX generation error:', error);
    return NextResponse.json({ error: 'PowerPoint generation failed. Try downloading as PDF instead.' }, { status: 500 });
  }
}
