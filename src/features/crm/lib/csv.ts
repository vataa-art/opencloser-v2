export type CsvLeadDraft = {
  id: string;
  name: string;
  company: string;
  phone: string;
  score: number;
  email?: string;
  title?: string;
};

export function parseLeadsCsv(text: string): { leads: CsvLeadDraft[]; skipped: number; errors: string[] } {
  const lines = splitCsvRows(text);
  if (lines.length < 1) return { leads: [], skipped: 0, errors: ["Empty file"] };

  const headerRow = parseCsvRow(lines[0]);
  const headers = headerRow.map(h => h.trim().toLowerCase());
  
  const colIdx = {
    name: headers.indexOf("name"),
    company: headers.indexOf("company"),
    phone: headers.indexOf("phone"),
    email: headers.indexOf("email"),
    title: headers.indexOf("title"),
    score: headers.indexOf("score")
  };

  if (colIdx.name === -1 || colIdx.company === -1 || colIdx.phone === -1) {
    return { leads: [], skipped: 0, errors: ["Missing required columns: Name, Company, Phone"] };
  }

  const leads: CsvLeadDraft[] = [];
  let skipped = 0;
  const errors: string[] = [];
  const seenPhones = new Set<string>();
  let counter = 1;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) continue;

    const name = (colIdx.name !== -1 && row[colIdx.name]) ? row[colIdx.name].trim() : "";
    const phone = (colIdx.phone !== -1 && row[colIdx.phone]) ? row[colIdx.phone].trim() : "";
    const company = (colIdx.company !== -1 && row[colIdx.company]) ? row[colIdx.company].trim() : "";

    if (!name || !phone) {
      skipped++;
      continue;
    }

    if (seenPhones.has(phone)) {
      skipped++;
      continue;
    }
    seenPhones.add(phone);

    const email = (colIdx.email !== -1 && row[colIdx.email]) ? row[colIdx.email].trim() : undefined;
    const title = (colIdx.title !== -1 && row[colIdx.title]) ? row[colIdx.title].trim() : undefined;
    
    let score = 0;
    if (colIdx.score !== -1 && row[colIdx.score]) {
      const parsed = parseInt(row[colIdx.score].trim(), 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        score = parsed;
      }
    }

    const sanitizedPhone = phone.replace(/\W/g, "");
    const id = `lead_csv_${counter++}_${sanitizedPhone}`;

    const draft: CsvLeadDraft = { id, name, company, phone, score };
    if (email) draft.email = email;
    if (title) draft.title = title;

    leads.push(draft);
  }

  return { leads, skipped, errors };
}

export function serializeLeadsCsv(rows: Array<{
  name: string; company: string; phone: string; status?: string; score?: number; email?: string; title?: string;
}>): string {
  const header = ["Name", "Company", "Phone", "Status", "Score", "Email", "Title"];
  
  const escapeCell = (cell: string | number | undefined) => {
    if (cell === undefined || cell === null) return "";
    const str = String(cell);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  let out = header.map(escapeCell).join(",") + "\n";
  
  for (const row of rows) {
    const rowArray = [
      row.name,
      row.company,
      row.phone,
      row.status || "",
      row.score !== undefined ? row.score : "",
      row.email || "",
      row.title || ""
    ];
    out += rowArray.map(escapeCell).join(",") + "\n";
  }

  return out.trim();
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let currentRow = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (char === '\n' && !inQuotes) {
      if (currentRow.endsWith('\r')) currentRow = currentRow.slice(0, -1);
      rows.push(currentRow);
      currentRow = "";
    } else {
      currentRow += char;
    }
  }
  if (currentRow.length > 0) {
    if (currentRow.endsWith('\r')) currentRow = currentRow.slice(0, -1);
    rows.push(currentRow);
  }
  return rows;
}

function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}
