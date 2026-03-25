
import * as XLSX from 'xlsx';
import { Student } from './types';

export const parseStudentList = async (file: File): Promise<Student[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const students: Student[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row[0]) {
            students.push({
              id: row[1] ? String(row[1]) : `ST-${Date.now()}-${i}`,
              name: row[0],
              marks: {},
              average: 0,
              riskLevel: 'Low',
            });
          }
        }
        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const parseMarksTemplate = async (file: File): Promise<{ students: Student[]; assessmentNames: string[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const headers = jsonData[0] as string[];
        const assessmentNames = headers.slice(2);

        const students: Student[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row[0]) {
            const marks: Record<string, number> = {};
            let total = 0;
            let count = 0;

            assessmentNames.forEach((assess, idx) => {
              const mark = parseFloat(row[idx + 2]);
              if (!isNaN(mark)) {
                marks[assess] = mark;
                total += mark;
                count++;
              }
            });

            students.push({
              name: row[0],
              id: row[1] ? String(row[1]) : `ST-${Date.now()}-${i}`,
              marks,
              average: count > 0 ? parseFloat((total / count).toFixed(1)) : 0,
              riskLevel: 'Low',
            });
          }
        }
        resolve({ students, assessmentNames });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const generateMarksTemplate = (
  students: Student[],
  assessmentNames: string[] = ['Term 1 Test', 'Assignment 1', 'Mid-Year Exam']
) => {
  const headers = ['Student Name', 'Student ID', ...assessmentNames];
  const data = students.map((s) => [s.name, s.id, ...assessmentNames.map(() => '')]);
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks');
  XLSX.writeFile(workbook, 'Assessment_Template.xlsx');
};
