import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDocx from 'remark-docx';

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
    const buffer = Buffer.from(arrayBuffer);

    const safeTitle = title.replace(/[^\w\s\-–—]/g, '').trim() || 'document';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeTitle)}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    return NextResponse.json(
      { error: 'DOCX generation failed. Try downloading as PDF instead.' },
      { status: 500 }
    );
  }
}
