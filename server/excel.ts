import ExcelJS from "exceljs";
import {
  DYNAMIC_FIELDS,
  matchDynamicField,
  cleanExcelCellValue,
} from "../shared/templateDesigner";

export interface ParsedExcelRow {
  rowNumber: number;
  studentName?: string;
  admissionCode?: string;
  data: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ExcelParseResult {
  headers: string[];
  mappedFields: Array<{ originalHeader: string; matchedKey: string; matchedLabel: string }>;
  unmappedHeaders: string[];
  rows: ParsedExcelRow[];
  errors: Array<{ rowNumber: number; reason: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;

/**
 * Extracts a sanitized, trimmed string value from an ExcelJS cell value.
 * Ignores formulas and extracts primitive results/text only.
 */
function extractCellValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
    return "";
  }
  if (typeof value === "object") {
    // Rich text support: join text segments
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text || "").join("").trim();
    }
    // Formulas: ignore formula, use static primitive result if available
    if ("formula" in value) {
      if (value.result !== undefined && value.result !== null && typeof value.result !== "object") {
        return String(value.result).trim();
      }
      return "";
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
  }
  return String(value).trim();
}

/**
 * Generate a dynamic example Excel file buffer using the template's available dynamic fields.
 */
export async function generateExampleExcelBuffer(
  fields: Array<{ key: string; label: string; category?: string }> = [...DYNAMIC_FIELDS],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("ID Card Requests");

  // Example row matching the header columns (for visual guidance only)
  const sampleRow: Record<string, string> = {
    // Student fields
    "Student Name": "Rahul Kumar",
    "Class": "10",
    "Section": "A",
    "Roll Number": "15",
    "Admission Number": "ADM-2026-001",
    "Date of Birth": "2010-05-12",
    "Gender": "Male",
    "Blood Group": "B+",
    "Father's Name": "Suresh Kumar",
    "Mother's Name": "Anita Devi",
    "Guardian Name": "Suresh Kumar",
    "Phone": "9876543210",
    "Address": "42 Park Avenue, New Delhi",
    "School Name": "Sample Public School",
    // Staff fields
    "Staff Name": "Dr. Priya Sharma",
    "Employee ID": "EMP-2026-042",
    "Department": "Mathematics",
    "Designation": "Senior Teacher",
    "Qualification": "M.Sc., B.Ed.",
    "Experience": "12 Years",
    "Joining Date": "2014-04-01",
  };

  worksheet.columns = fields.map((f) => ({
    header: f.label,
    key: f.key,
    width: Math.max(f.label.length + 4, 15),
  }));

  const rowValues = fields.map((f) => sampleRow[f.label] || "");
  worksheet.addRow(rowValues);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parses an uploaded Excel buffer into validated ID card request rows.
 * Enforces:
 * - max file size 5 MB
 * - max 5000 rows
 * - max 60 columns
 * - cell values only (ignore formulas)
 * - trimmed values
 */
export async function parseExcelBuffer(
  buffer: Buffer,
  availableFields: Array<{ key: string; label: string }> = [...DYNAMIC_FIELDS],
): Promise<ExcelParseResult> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Uploaded Excel file exceeds maximum allowed size of 5 MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch (xlsxErr) {
    // Fallback: try parsing as CSV if not a binary zip xlsx
    try {
      const { Readable } = await import("node:stream");
      await workbook.csv.read(Readable.from(buffer));
    } catch {
      throw new Error(`Failed to parse Excel spreadsheet: ${(xlsxErr as Error)?.message || "Invalid file"}`);
    }
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    throw new Error("Uploaded Excel workbook contains no sheets or is completely empty");
  }

  if (worksheet.rowCount > MAX_ROWS) {
    throw new Error(`Spreadsheet exceeds maximum limit of ${MAX_ROWS} rows (found ${worksheet.rowCount})`);
  }

  const headerRow = worksheet.getRow(1);
  if (!headerRow || headerRow.cellCount === 0) {
    throw new Error("No header columns found in spreadsheet");
  }

  if (headerRow.cellCount > MAX_COLUMNS) {
    throw new Error(`Spreadsheet exceeds maximum limit of ${MAX_COLUMNS} columns (found ${headerRow.cellCount})`);
  }

  // Row 1 is headers
  const headers: string[] = [];
  const mappedFields: Array<{ originalHeader: string; matchedKey: string; matchedLabel: string; colIndex: number }> = [];
  const unmappedHeaders: string[] = [];

  for (let c = 1; c <= headerRow.cellCount; c++) {
    if (c > MAX_COLUMNS) break;
    const cell = headerRow.getCell(c);
    const h = extractCellValue(cell.value);
    if (!h) continue;

    headers.push(h);

    const matched = matchDynamicField(h, availableFields);
    if (matched) {
      mappedFields.push({
        originalHeader: h,
        matchedKey: matched.key,
        matchedLabel: matched.label,
        colIndex: c,
      });
    } else {
      unmappedHeaders.push(h);
    }
  }

  if (headers.length === 0) {
    throw new Error("Header row contains no valid column names");
  }

  if (mappedFields.length === 0) {
    throw new Error(
      `No recognized dynamic field columns found. Please ensure headers match the template fields (e.g. ${availableFields.slice(0, 5).map((f) => `"${f.label}"`).join(", ")}).`,
    );
  }

  const rows: ParsedExcelRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rowNumber = r;

    // Check if entire row is empty
    let hasAnyValue = false;
    for (let c = 1; c <= Math.min(row.cellCount, MAX_COLUMNS); c++) {
      if (extractCellValue(row.getCell(c).value) !== "") {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) {
      continue;
    }

    const data: Record<string, string> = {};
    const raw: Record<string, unknown> = {};

    for (const mf of mappedFields) {
      const cell = row.getCell(mf.colIndex);
      const cellVal = extractCellValue(cell.value);
      raw[mf.originalHeader] = cellVal;

      const cleaned = cleanExcelCellValue(cellVal);
      if (cleaned !== undefined && cleaned !== "") {
        let safeVal = cleaned.trim();
        // Strip potential dangerous CSV/formula prefix characters for defense-in-depth
        if (safeVal.startsWith("=") || safeVal.startsWith("+") || safeVal.startsWith("-") || safeVal.startsWith("@")) {
          if (safeVal.length > 1 && !/^-?\d+(\.\d+)?$/.test(safeVal)) {
            safeVal = safeVal.replace(/^[=+\-@]+/, "");
          }
        }
        data[mf.matchedKey] = safeVal;
      }
    }

    const studentName = data["student_name"] || data["staff_name"] || data["name"] || undefined;
    const admissionCode = data["admission_number"] || data["employee_id"] || data["admission_code"] || data["roll_number"] || undefined;

    if (!studentName && !admissionCode && Object.keys(data).length === 0) {
      continue;
    }

    if (!studentName && !admissionCode) {
      errors.push({
        rowNumber,
        reason: "Row is missing Name and Identifier (Admission Number, Roll Number, or Employee ID)",
      });
      continue;
    }

    rows.push({
      rowNumber,
      studentName,
      admissionCode,
      data,
      raw,
    });
  }

  return {
    headers,
    mappedFields: mappedFields.map(({ originalHeader, matchedKey, matchedLabel }) => ({
      originalHeader,
      matchedKey,
      matchedLabel,
    })),
    unmappedHeaders,
    rows,
    errors,
  };
}
