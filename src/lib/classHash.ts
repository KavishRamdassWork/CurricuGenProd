import { Classroom } from './types';

/** Deterministic hash of the classroom fields that influence AI generation.
 *  Used to detect when saved lesson content was generated under different
 *  settings than the classroom currently has. */
export function computeSettingsHash(c: Pick<Classroom,
  'subject' | 'grade' | 'curriculum' | 'studentCount' | 'averagePercentile' |
  'learningStyles' | 'accommodations' | 'studentInterests' | 'teachingNotes'
>): string {
  return [
    c.subject,
    c.grade,
    c.curriculum,
    c.studentCount,
    c.averagePercentile,
    (c.learningStyles ?? []).slice().sort().join(','),
    c.accommodations ?? '',
    c.studentInterests ?? '',
    c.teachingNotes ?? '',
  ].join('|');
}
