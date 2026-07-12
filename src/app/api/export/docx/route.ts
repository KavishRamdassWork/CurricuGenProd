import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDocx from 'remark-docx';
import buildRateLimit from '@/lib/rateLimit';

const exportLimiter = buildRateLimit({ uniqueTokenPerInterval: 500, interval: 60000 });

interface ExportBody {
  content: string;
  title: string;
  docType: 'teacher' | 'student';
  metadata: {
    subject?: string;
    grade?: string;
    className?: string;
    schoolName?: string;
  };
}

function buildStudentHeader(metadata: ExportBody['metadata']): string {
  const lines: string[] = [];
  if (metadata.schoolName) {
    lines.push(`# ${metadata.schoolName}`);
    lines.push('');
  }
  lines.push(
    `**Subject:** ${metadata.subject ?? ''} &nbsp;&nbsp; **Grade:** ${metadata.grade ?? ''} &nbsp;&nbsp; **Class:** ${metadata.className ?? ''}`
  );
  lines.push('');
  lines.push('**Name:** _________________________ &nbsp;&nbsp; **Date:** _____________ &nbsp;&nbsp; **Total:** ___ /');
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

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

  let body: ExportBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { content, title, docType, metadata } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Missing or empty content' }, { status: 400 });
  }
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  }
  if (docType !== 'teacher' && docType !== 'student') {
    return NextResponse.json({ error: 'Invalid docType — must be teacher or student' }, { status: 400 });
  }

  const processedContent =
    docType === 'student' ? buildStudentHeader(metadata ?? {}) + content : content;

  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDocx);

    const file = await processor.process(processedContent);
    const arrayBuffer = await (file.result as Promise<ArrayBuffer>);
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('Unexpected output from remark-docx — expected ArrayBuffer');
    }
    const buffer = Buffer.from(arrayBuffer);

    const safeTitle = title
      .replace(/[\r\n]/g, '')           // strip newlines first (CRLF injection defence)
      .replace(/[^\w \-–—]/g, '')       // keep word chars, spaces, dashes
      .trim() || 'document';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('DOCX generation error:', error);
    return NextResponse.json(
      { error: 'DOCX generation failed. Try downloading as PDF instead.' },
      { status: 500 }
    );
  }
}
