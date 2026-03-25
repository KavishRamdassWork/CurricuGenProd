/**
 * Helper to determine the educational phase based on the grade.
 * This ensures the curriculum embedding retrieval filters by the correct phase.
 */
export function getPhaseForGrade(grade: string): string {
  const g = grade.toLowerCase();
  
  if (['grade r', 'grade 1', 'grade 2', 'grade 3', 'k', '1st', '2nd', '3rd'].includes(g)) {
    return 'Foundation Phase';
  }
  
  if (['grade 4', 'grade 5', 'grade 6', '4th', '5th', '6th'].includes(g)) {
    return 'Intermediate Phase';
  }
  
  if (['grade 7', 'grade 8', 'grade 9', '7th', '8th', '9th'].includes(g)) {
    return 'Senior Phase';
  }
  
  if (['grade 10', 'grade 11', 'grade 12', '10th', '11th', '12th'].includes(g)) {
    return 'FET Phase';
  }

  // Default fallback if unknown
  return 'General';
}
