import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const csvPath =
    process.argv[2] ||
    "/Users/saanu/Downloads/Divident Portfolio Sample.csv";

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV appears empty.");
    process.exit(1);
  }

  const [, ...rows] = lines; // skip header

  const holdings = rows.map((line) => {
    const cols = splitCsvLine(line);
    if (cols.length < 13) {
      throw new Error(`Unexpected column count in line: ${line}`);
    }

    const [
      ticker,
      company,
      sector,
      priceStr,
      peStr,
      annDivStr,
      curYieldStr,
      avgYieldStr,
      valuation,
      payoutStr,
      growthStr,
      siVerdict,
      whyItFits
    ] = cols;

    const parseMoney = (s: string) =>
      Number(s.replace(/[$,]/g, "").trim() || "0");
    const parsePercent = (s: string) =>
      Number(s.replace(/[%]/g, "").trim() || "0");
    const parseNumber = (s: string) =>
      s.trim() ? Number(s.replace(/[%,$]/g, "")) : null;

    return {
      ticker: ticker.trim(),
      company: company.trim(),
      sector: sector.trim(),
      price: parseMoney(priceStr),
      pe: parseNumber(peStr),
      annualDiv: parseMoney(annDivStr),
      currentYield: parsePercent(curYieldStr),
      avgYield5y: parseNumber(avgYieldStr),
      valuation: valuation.trim(),
      payoutPct: parseNumber(payoutStr),
      growth5y: parseNumber(growthStr),
      siVerdict: siVerdict.trim(),
      whyItFits: whyItFits.trim()
    };
  });

  console.log(`Importing ${holdings.length} holdings...`);

  for (const h of holdings) {
    await prisma.dividendHolding.upsert({
      where: { ticker: h.ticker },
      update: h,
      create: h
    });
  }

  console.log("Import complete.");
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

