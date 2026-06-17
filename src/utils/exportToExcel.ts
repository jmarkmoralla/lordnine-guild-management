import * as XLSX from 'xlsx';

export interface SummaryExportRow {
  name: string;
  guildName: string;
  kransia: number;
  kransiaCount: number;
  fieldBoss: number;
  fieldBossCount: number;
  guildBoss: number;
  guildBossCount: number;
  guildvsguild: number;
  guildvsguildCount: number;
  computedTotalAttendance: number;
  participationPercent: number;
  computedPercentage: number;
  computedUsdtShare: number;
  computedMultiplier: number;
}

export function buildAndDownloadAttendanceWorkbook(
  summaryRows: SummaryExportRow[]
): void {
  const header = [
    'No.',
    'Name',
    'Guild',
    'Kransia',
    'Kransia Count',
    'Field Boss',
    'Field Boss Count',
    'Guild Boss',
    'Guild Boss Count',
    'Guild vs Guild',
    'Guild vs Guild Count',
    'Total Pts',
    'Participation%',
    '%',
    'USDT Share',
    'Multiplier',
  ];

  const data = summaryRows.map((row, index) => [
    index + 1,
    row.name,
    row.guildName,
    row.kransia,
    row.kransiaCount,
    row.fieldBoss,
    row.fieldBossCount,
    row.guildBoss,
    row.guildBossCount,
    row.guildvsguild,
    row.guildvsguildCount,
    row.computedTotalAttendance,
    Number(row.participationPercent.toFixed(2)),
    Number(row.computedPercentage.toFixed(2)),
    Number(row.computedUsdtShare.toFixed(2)),
    row.computedMultiplier,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  ws['!cols'] = [
    { wch: 5 },   // No.
    { wch: 22 },  // Name
    { wch: 14 },  // Guild
    { wch: 10 },  // Kransia
    { wch: 14 },  // Kransia Count
    { wch: 12 },  // Field Boss
    { wch: 16 },  // Field Boss Count
    { wch: 12 },  // Guild Boss
    { wch: 14 },  // Guild Boss Count
    { wch: 16 },  // Guild vs Guild
    { wch: 18 },  // Guild vs Guild Count
    { wch: 10 },  // Total Pts
    { wch: 16 },  // Participation%
    { wch: 8 },   // %
    { wch: 14 },  // USDT Share
    { wch: 10 },  // Multiplier
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');

  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `attendance-report-${datePart}.xlsx`;

  XLSX.writeFile(wb, filename);
}
