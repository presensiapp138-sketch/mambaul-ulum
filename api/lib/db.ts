import { google, sheets_v4 } from 'googleapis';
import {
  DatabaseSchema,
  User,
  Teacher,
  SchoolClass,
  Student,
  FaceTemplate,
  StudentAttendance,
  TeacherAttendance,
  ToiletPermit,
  SchoolLocation,
  AuditLog,
  ChangeLog,
  FollowUpNote,
  SchoolSettings
} from './types.ts';
import { hashPassword } from './auth.ts';

// Cache for short TTL to prevent hitting Google API quotas
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cacheStore: Record<string, CacheEntry<unknown>> = {};
const CACHE_TTL_MS = 3000; // 3 seconds TTL

// Headers for each sheet table
export const SHEET_HEADERS: Record<string, string[]> = {
  Settings: ['id', 'key', 'value', 'createdAt', 'updatedAt', 'updatedBy'],
  Users: ['id', 'username', 'passwordHash', 'role', 'name', 'email', 'classId', 'isActive', 'createdAt', 'updatedAt', 'updatedBy'],
  Teachers: ['id', 'nip', 'name', 'email', 'phone', 'subject', 'isActive', 'createdAt', 'updatedAt', 'updatedBy'],
  Classes: ['id', 'name', 'grade', 'academicYear', 'homeRoomTeacherId', 'createdAt', 'updatedAt', 'updatedBy'],
  Students: ['id', 'nis', 'nisn', 'name', 'gender', 'classId', 'barcodeCard', 'parentPhone', 'isActive', 'createdAt', 'updatedAt', 'updatedBy'],
  FaceTemplates: ['id', 'personId', 'personType', 'descriptor', 'createdAt', 'updatedAt', 'updatedBy'],
  StudentAttendance: ['id', 'studentId', 'date', 'timeIn', 'status', 'method', 'notes', 'createdAt', 'updatedAt', 'updatedBy'],
  TeacherAttendance: ['id', 'teacherId', 'date', 'timeIn', 'timeOut', 'status', 'method', 'latitude', 'longitude', 'distanceMeters', 'photoDriveUrl', 'notes', 'createdAt', 'updatedAt', 'updatedBy'],
  ToiletPermits: ['id', 'studentId', 'date', 'timeOut', 'timeIn', 'durationMinutes', 'status', 'createdAt', 'updatedAt', 'updatedBy'],
  Locations: ['id', 'name', 'latitude', 'longitude', 'radiusMeters', 'isActive', 'createdAt', 'updatedAt', 'updatedBy'],
  AuditLog: ['id', 'userId', 'action', 'entity', 'entityId', 'details', 'ipAddress', 'createdAt', 'updatedAt', 'updatedBy'],
  ChangeLog: ['id', 'tableName', 'recordId', 'action', 'timestamp', 'updatedBy'],
  FollowUpNotes: ['id', 'studentId', 'date', 'category', 'notes', 'actionPlan', 'status', 'counselorId', 'createdAt', 'updatedAt', 'updatedBy']
};

// Default seed data for initial setup or fallback mode
function getInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    Settings: {
      schoolName: 'Yayasan Mambaul Ulum',
      schoolLogo: '',
      academicYear: '2026/2027',
      checkInTime: '07:00',
      lateCutoffTime: '07:15',
      checkOutTime: '15:00',
      toiletMaxMinutes: '10',
      warningThresholdAbsent: '3',
      warningThresholdLate: '3',
      warningThresholdToilet: '4',
      teacherPhotoProofEnabled: 'false',
      parentNotificationEnabled: 'true',
      holidays: '[]',
      foundationAddress: 'Jl. Pesantren Mambaul Ulum No. 45, Diwek, Jombang, Jawa Timur 61471',
      foundationWebsite: 'https://mambaululum.sch.id',
      foundationWatermarkUrl: '',
      foundationQrCodeUrl: '',
      levelConfigsJson: '',
    },
    Users: [
      {
        id: 'usr-admin-1',
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
        name: 'Administrator Utama',
        email: 'admin@sekolah.sch.id',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'usr-wali-1',
        username: 'wali1',
        passwordHash: hashPassword('guru123'),
        role: 'wali_kelas',
        name: 'Budi Santoso, S.Pd',
        email: 'budi.santoso@sekolah.sch.id',
        classId: 'cls-10-rpl-1',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'usr-bk-1',
        username: 'bk1',
        passwordHash: hashPassword('bk123'),
        role: 'bk',
        name: 'Siti Rahayu, S.Psi',
        email: 'siti.rahayu@sekolah.sch.id',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'usr-kesiswaan-1',
        username: 'kesiswaan1',
        passwordHash: hashPassword('kesiswaan123'),
        role: 'kesiswaan',
        name: 'Ahmad Fauzi, M.Pd',
        email: 'ahmad.fauzi@sekolah.sch.id',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'usr-guru-1',
        username: 'guru1',
        passwordHash: hashPassword('guru123'),
        role: 'guru',
        name: 'Dewi Lestari, S.Pd',
        email: 'dewi.lestari@sekolah.sch.id',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    Teachers: [
      {
        id: 'tch-1',
        nip: '198501152010011002',
        name: 'Budi Santoso, S.Pd',
        email: 'budi.santoso@sekolah.sch.id',
        phone: '081234567801',
        subject: 'Rekayasa Perangkat Lunak',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'tch-2',
        nip: '198804202012022003',
        name: 'Dewi Lestari, S.Pd',
        email: 'dewi.lestari@sekolah.sch.id',
        phone: '081234567802',
        subject: 'Basis Data & Cloud',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'tch-3',
        nip: '199009122015031005',
        name: 'Ahmad Fauzi, M.Pd',
        email: 'ahmad.fauzi@sekolah.sch.id',
        phone: '081234567803',
        subject: 'Matematika Terapan',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    Classes: [
      {
        id: 'cls-sma-1',
        name: 'X MIPA 1',
        grade: '10',
        academicYear: '2026/2027',
        level: 'SMA/MA',
        homeRoomTeacherId: 'tch-1',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'cls-sma-2',
        name: 'XI MIPA 1',
        grade: '11',
        academicYear: '2026/2027',
        level: 'SMA/MA',
        homeRoomTeacherId: 'tch-2',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'cls-smp-1',
        name: 'VII A',
        grade: '7',
        academicYear: '2026/2027',
        level: 'SMP/MTS',
        homeRoomTeacherId: 'tch-3',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'cls-smp-2',
        name: 'VIII B',
        grade: '8',
        academicYear: '2026/2027',
        level: 'SMP/MTS',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'cls-sd-1',
        name: 'IV A',
        grade: '4',
        academicYear: '2026/2027',
        level: 'SD/MI',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'cls-sd-2',
        name: 'I B',
        grade: '1',
        academicYear: '2026/2027',
        level: 'SD/MI',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    Students: [
      // 1. SISWA SMA/MA
      {
        id: 'std-sma-1',
        nis: '2601001',
        nisn: '0071234561',
        name: 'Aditya Pratama Putra',
        gender: 'L',
        classId: 'cls-sma-1',
        barcodeCard: 'CARD-2601001',
        parentPhone: '081298765431',
        level: 'SMA/MA',
        birthPlace: 'Jombang',
        birthDate: '14 Januari 2009',
        bloodType: 'O',
        photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'std-sma-2',
        nis: '2601002',
        nisn: '0071234562',
        name: 'Annisa Fitri Ramadhani',
        gender: 'P',
        classId: 'cls-sma-1',
        barcodeCard: 'CARD-2601002',
        parentPhone: '081298765432',
        level: 'SMA/MA',
        birthPlace: 'Surabaya',
        birthDate: '21 Mei 2009',
        bloodType: 'A',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'std-sma-3',
        nis: '2501003',
        nisn: '0061234563',
        name: 'Bayu Arya Wiguna',
        gender: 'L',
        classId: 'cls-sma-2',
        barcodeCard: 'CARD-2501003',
        parentPhone: '081298765433',
        level: 'SMA/MA',
        birthPlace: 'Malang',
        birthDate: '03 Maret 2008',
        bloodType: 'B',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },

      // 2. SISWA SMP/MTS
      {
        id: 'std-smp-1',
        nis: '2602001',
        nisn: '0101234581',
        name: 'Cantika Dewi Maharani',
        gender: 'P',
        classId: 'cls-smp-1',
        barcodeCard: 'CARD-2602001',
        parentPhone: '081298765434',
        level: 'SMP/MTS',
        birthPlace: 'Jombang',
        birthDate: '18 Agustus 2012',
        bloodType: 'AB',
        photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'std-smp-2',
        nis: '2602002',
        nisn: '0101234582',
        name: 'Dimas Setiawan Al-Faruq',
        gender: 'L',
        classId: 'cls-smp-1',
        barcodeCard: 'CARD-2602002',
        parentPhone: '081298765435',
        level: 'SMP/MTS',
        birthPlace: 'Kediri',
        birthDate: '11 November 2012',
        bloodType: 'O',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'std-smp-3',
        nis: '2502003',
        nisn: '0091234583',
        name: 'Fathir Ahmad Shidiq',
        gender: 'L',
        classId: 'cls-smp-2',
        barcodeCard: 'CARD-2502003',
        parentPhone: '081298765436',
        level: 'SMP/MTS',
        birthPlace: 'Mojokerto',
        birthDate: '25 Juni 2011',
        bloodType: 'A',
        photoUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },

      // 3. SISWA SD/MI
      {
        id: 'std-sd-1',
        nis: '2603001',
        nisn: '0131234591',
        name: 'Hafizhah Nurul Izzati',
        gender: 'P',
        classId: 'cls-sd-1',
        barcodeCard: 'CARD-2603001',
        parentPhone: '081298765437',
        level: 'SD/MI',
        birthPlace: 'Jombang',
        birthDate: '09 September 2015',
        bloodType: 'B',
        photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
      {
        id: 'std-sd-2',
        nis: '2603002',
        nisn: '0161234592',
        name: 'Ibrahim Al-Ghazali',
        gender: 'L',
        classId: 'cls-sd-2',
        barcodeCard: 'CARD-2603002',
        parentPhone: '081298765438',
        level: 'SD/MI',
        birthPlace: 'Jombang',
        birthDate: '02 Februari 2019',
        bloodType: 'O',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=380&q=80',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    FaceTemplates: [],
    StudentAttendance: [],
    TeacherAttendance: [],
    ToiletPermits: [],
    Locations: [
      {
        id: 'loc-1',
        name: 'Kampus Utama SMK',
        latitude: -6.2088,
        longitude: 106.8456,
        radiusMeters: 150,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    AuditLog: [
      {
        id: 'aud-1',
        userId: 'system',
        action: 'INIT_SYSTEM',
        entity: 'System',
        entityId: 'sys-0',
        details: 'Sistem presensi berhasil diinisialisasi.',
        createdAt: now,
        updatedAt: now,
        updatedBy: 'system',
      },
    ],
    ChangeLog: [
      {
        id: 'chg-1',
        tableName: 'System',
        recordId: 'init',
        action: 'CREATE',
        timestamp: now,
        updatedBy: 'system',
      },
    ],
    FollowUpNotes: [],
  };
}

// In-memory store fallback when Google credentials are not yet set
let memoryStore: DatabaseSchema = getInitialSeedData();

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.SPREADSHEET_ID
  );
}

function getGoogleSheetsClient(): sheets_v4.Sheets | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKey) return null;

  // Handle formatted private key with escaped newlines
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return google.sheets({ version: 'v4', auth });
}

// Ensure all required sheets and header rows exist in Google Sheets
export async function initializeDatabase(): Promise<{ success: boolean; message: string; sheetsInitialized: string[] }> {
  if (!isGoogleSheetsConfigured()) {
    return {
      success: true,
      message: 'Running in simulated database mode (Google Sheets credentials not yet configured in .env). Data is stored in-memory.',
      sheetsInitialized: Object.keys(SHEET_HEADERS),
    };
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Google Sheets client could not be initialized');

  // Fetch current sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheetTitles = meta.data.sheets?.map(s => s.properties?.title || '') || [];

  const sheetsToCreate: string[] = [];
  const batchRequests: sheets_v4.Schema$Request[] = [];

  for (const sheetName of Object.keys(SHEET_HEADERS)) {
    if (!existingSheetTitles.includes(sheetName)) {
      sheetsToCreate.push(sheetName);
      batchRequests.push({
        addSheet: {
          properties: {
            title: sheetName,
            gridProperties: { rowCount: 1000, columnCount: 20 },
          },
        },
      });
    }
  }

  if (batchRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: batchRequests },
    });
  }

  // Populate headers for new sheets or empty sheets
  for (const sheetName of Object.keys(SHEET_HEADERS)) {
    const headers = SHEET_HEADERS[sheetName];
    const checkHeader = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:Z1`,
    });

    if (!checkHeader.data.values || checkHeader.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });

      // If Settings or Users is newly created, seed default data
      if (sheetName === 'Settings') {
        const seed = getInitialSeedData();
        const settingsRows = Object.entries(seed.Settings).map(([key, value], idx) => [
          `set-${idx + 1}`,
          key,
          value,
          new Date().toISOString(),
          new Date().toISOString(),
          'system',
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Settings'!A:F`,
          valueInputOption: 'RAW',
          requestBody: { values: settingsRows },
        });
      } else if (sheetName === 'Users') {
        const seed = getInitialSeedData();
        const userRows = seed.Users.map(u => [
          u.id, u.username, u.passwordHash, u.role, u.name, u.email, u.classId || '', String(u.isActive), u.createdAt, u.updatedAt, u.updatedBy
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Users'!A:K`,
          valueInputOption: 'RAW',
          requestBody: { values: userRows },
        });
      } else if (sheetName === 'Classes') {
        const seed = getInitialSeedData();
        const rows = seed.Classes.map(c => [
          c.id, c.name, c.grade, c.academicYear, c.homeRoomTeacherId || '', c.createdAt, c.updatedAt, c.updatedBy
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Classes'!A:H`,
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        });
      } else if (sheetName === 'Students') {
        const seed = getInitialSeedData();
        const rows = seed.Students.map(s => [
          s.id, s.nis, s.nisn, s.name, s.gender, s.classId, s.barcodeCard, s.parentPhone, String(s.isActive), s.createdAt, s.updatedAt, s.updatedBy
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Students'!A:K`,
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        });
      } else if (sheetName === 'Teachers') {
        const seed = getInitialSeedData();
        const rows = seed.Teachers.map(t => [
          t.id, t.nip, t.name, t.email, t.phone, t.subject, String(t.isActive), t.createdAt, t.updatedAt, t.updatedBy
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Teachers'!A:J`,
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        });
      } else if (sheetName === 'Locations') {
        const seed = getInitialSeedData();
        const rows = seed.Locations.map(l => [
          l.id, l.name, String(l.latitude), String(l.longitude), String(l.radiusMeters), String(l.isActive), l.createdAt, l.updatedAt, l.updatedBy
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Locations'!A:H`,
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        });
      }
    }
  }

  // Clear cache
  Object.keys(cacheStore).forEach(k => delete cacheStore[k]);

  return {
    success: true,
    message: 'Google Sheets tables and headers successfully initialized!',
    sheetsInitialized: Object.keys(SHEET_HEADERS),
  };
}

// Generic Read Table from Google Sheets or In-Memory
export async function getTableRecords<T>(tableName: keyof DatabaseSchema): Promise<T[]> {
  const cacheKey = `table_${tableName}`;
  const cached = cacheStore[cacheKey];
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data as T[];
  }

  if (!isGoogleSheetsConfigured()) {
    const data = (memoryStore[tableName] as unknown) as T[];
    cacheStore[cacheKey] = { data, timestamp: now };
    return data;
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Sheets client unavailable');

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tableName}'!A1:Z5000`,
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) {
      cacheStore[cacheKey] = { data: [], timestamp: now };
      return [];
    }

    const headers = rows[0].map(h => String(h).trim());
    const records: T[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || !row[0]) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        const val = row[colIdx] !== undefined ? row[colIdx] : '';
        // Parse types based on field name
        if (h === 'isActive' || h === 'teacherPhotoProofEnabled' || h === 'parentNotificationEnabled') {
          obj[h] = val === 'true' || val === true;
        } else if (h === 'descriptor') {
          try {
            obj[h] = typeof val === 'string' ? JSON.parse(val) : val;
          } catch {
            obj[h] = [];
          }
        } else if (h === 'latitude' || h === 'longitude' || h === 'radiusMeters' || h === 'distanceMeters' || h === 'durationMinutes') {
          obj[h] = val !== '' ? Number(val) : undefined;
        } else {
          obj[h] = val;
        }
      });
      records.push(obj as T);
    }

    cacheStore[cacheKey] = { data: records, timestamp: now };
    return records;
  } catch (err) {
    console.warn(`Failed to read from Google Sheet ${tableName}, falling back to memory:`, err);
    return (memoryStore[tableName] as unknown) as T[];
  }
}

// Append a single row with ChangeLog and AuditLog
export async function appendRecord<T extends { id: string; updatedAt?: string }>(
  tableName: keyof DatabaseSchema,
  record: T,
  updatedBy: string = 'system'
): Promise<T> {
  const now = new Date().toISOString();
  const fullRecord = {
    ...record,
    createdAt: (record as Record<string, unknown>).createdAt || now,
    updatedAt: now,
    updatedBy,
  };

  const headers = SHEET_HEADERS[tableName];
  if (!headers) throw new Error(`Unknown table: ${tableName}`);

  // Invalidate cache
  delete cacheStore[`table_${tableName}`];

  if (!isGoogleSheetsConfigured()) {
    const list = memoryStore[tableName] as unknown as T[];
    list.push(fullRecord);
    // Record changelog in memory
    memoryStore.ChangeLog.push({
      id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tableName,
      recordId: fullRecord.id,
      action: 'CREATE',
      timestamp: now,
      updatedBy,
    });
    return fullRecord;
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Sheets client unavailable');

  const rowValues = headers.map(h => {
    const val = (fullRecord as Record<string, unknown>)[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tableName}'!A:Z`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowValues] },
  });

  // Record change in ChangeLog
  await recordChangeLog(tableName, fullRecord.id, 'CREATE', updatedBy);

  return fullRecord;
}

// Update an existing row by ID with Optimistic Locking check (updatedAt)
export async function updateRecord<T extends { id: string; updatedAt?: string }>(
  tableName: keyof DatabaseSchema,
  id: string,
  partialUpdate: Partial<T>,
  expectedUpdatedAt?: string,
  updatedBy: string = 'system'
): Promise<T> {
  const now = new Date().toISOString();
  delete cacheStore[`table_${tableName}`];

  if (!isGoogleSheetsConfigured()) {
    const list = memoryStore[tableName] as unknown as T[];
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Record with id ${id} not found in ${tableName}`);

    const existing = list[idx];
    if (expectedUpdatedAt && existing.updatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new Error(`Conflict error (Optimistic Lock): data has been modified by another device.`);
    }

    const updated = {
      ...existing,
      ...partialUpdate,
      id,
      updatedAt: now,
      updatedBy,
    };
    list[idx] = updated;

    memoryStore.ChangeLog.push({
      id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tableName,
      recordId: id,
      action: 'UPDATE',
      timestamp: now,
      updatedBy,
    });

    return updated;
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Sheets client unavailable');

  // Fetch all rows to locate row index and verify optimistic locking
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tableName}'!A1:Z5000`,
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) throw new Error(`Table ${tableName} is empty`);

  const headers = rows[0].map(h => String(h).trim());
  const idColIdx = headers.indexOf('id');
  const updatedAtColIdx = headers.indexOf('updatedAt');

  let targetRowIdx = -1;
  let currentRowData: Record<string, unknown> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[idColIdx] === id) {
      targetRowIdx = i + 1; // 1-indexed for Sheets
      headers.forEach((h, ci) => {
        currentRowData[h] = row[ci] !== undefined ? row[ci] : '';
      });
      break;
    }
  }

  if (targetRowIdx === -1) {
    throw new Error(`Record with id ${id} not found in Google Sheet ${tableName}`);
  }

  // Optimistic locking check
  if (expectedUpdatedAt && updatedAtColIdx !== -1) {
    const currentUpdatedAt = String(currentRowData['updatedAt'] || '');
    if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      throw new Error(`Conflict error: data ${id} was updated concurrently.`);
    }
  }

  const merged = {
    ...currentRowData,
    ...partialUpdate,
    id,
    updatedAt: now,
    updatedBy,
  };

  const newRowValues = headers.map(h => {
    const val = merged[h];
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });

  const endColChar = String.fromCharCode(65 + headers.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tableName}'!A${targetRowIdx}:${endColChar}${targetRowIdx}`,
    valueInputOption: 'RAW',
    requestBody: { values: [newRowValues] },
  });

  await recordChangeLog(tableName, id, 'UPDATE', updatedBy);
  return (merged as unknown) as T;
}

// Delete a row by ID (or mark inactive)
export async function deleteRecord(
  tableName: keyof DatabaseSchema,
  id: string,
  updatedBy: string = 'system'
): Promise<boolean> {
  const now = new Date().toISOString();
  delete cacheStore[`table_${tableName}`];

  if (!isGoogleSheetsConfigured()) {
    const list = memoryStore[tableName] as unknown as { id: string }[];
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      memoryStore.ChangeLog.push({
        id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tableName,
        recordId: id,
        action: 'DELETE',
        timestamp: now,
        updatedBy,
      });
      return true;
    }
    return false;
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Sheets client unavailable');

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetObj = meta.data.sheets?.find(s => s.properties?.title === tableName);
  if (!sheetObj || sheetObj.properties?.sheetId === undefined) {
    throw new Error(`Sheet ${tableName} not found`);
  }
  const sheetIdNum = sheetObj.properties.sheetId;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tableName}'!A1:A5000`,
  });

  const rows = res.data.values || [];
  let rowIndexZeroBased = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][0] === id) {
      rowIndexZeroBased = i;
      break;
    }
  }

  if (rowIndexZeroBased === -1) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetIdNum,
              dimension: 'ROWS',
              startIndex: rowIndexZeroBased,
              endIndex: rowIndexZeroBased + 1,
            },
          },
        },
      ],
    },
  });

  await recordChangeLog(tableName, id, 'DELETE', updatedBy);
  return true;
}

// Record ChangeLog entry
async function recordChangeLog(
  tableName: string,
  recordId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  updatedBy: string
) {
  const changeEntry: ChangeLog = {
    id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tableName,
    recordId,
    action,
    timestamp: new Date().toISOString(),
    updatedBy,
  };

  try {
    if (!isGoogleSheetsConfigured()) {
      memoryStore.ChangeLog.push(changeEntry);
      return;
    }
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID!;
    if (!sheets) return;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'ChangeLog'!A:F`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          changeEntry.id,
          changeEntry.tableName,
          changeEntry.recordId,
          changeEntry.action,
          changeEntry.timestamp,
          changeEntry.updatedBy,
        ]],
      },
    });
  } catch (err) {
    console.error('Failed to append to ChangeLog:', err);
  }
}

// Record AuditLog entry
export async function recordAudit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  details: string,
  ipAddress?: string
) {
  const now = new Date().toISOString();
  const entry: AuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId,
    action,
    entity,
    entityId,
    details,
    ipAddress,
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  };

  try {
    if (!isGoogleSheetsConfigured()) {
      memoryStore.AuditLog.push(entry);
      return;
    }
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID!;
    if (!sheets) return;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'AuditLog'!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          entry.id,
          entry.userId,
          entry.action,
          entry.entity,
          entry.entityId,
          entry.details,
          entry.ipAddress || '',
          entry.createdAt,
          entry.updatedAt,
          entry.updatedBy,
        ]],
      },
    });
  } catch (err) {
    console.error('Failed to append to AuditLog:', err);
  }
}

export async function getSchoolSettings(): Promise<SchoolSettings> {
  const defaults = getInitialSeedData().Settings;
  const map: Record<string, string> = { ...defaults };

  if (!isGoogleSheetsConfigured()) {
    Object.assign(map, memoryStore.Settings);
  } else {
    const records = await getTableRecords<{ key: string; value: string }>('Settings');
    if (Array.isArray(records)) {
      records.forEach(r => {
        if (r.key) map[r.key] = r.value;
      });
    }
  }

  return {
    schoolName: map.schoolName || 'Yayasan Mambaul Ulum',
    schoolLogo: map.schoolLogo || '',
    academicYear: map.academicYear || '2026/2027',
    checkInTime: map.checkInTime || '07:00',
    lateCutoffTime: map.lateCutoffTime || '07:15',
    checkOutTime: map.checkOutTime || '15:00',
    toiletMaxMinutes: Number(map.toiletMaxMinutes) || 10,
    warningThresholdAbsent: Number(map.warningThresholdAbsent) || 3,
    warningThresholdLate: Number(map.warningThresholdLate) || 3,
    warningThresholdToilet: Number(map.warningThresholdToilet) || 4,
    teacherPhotoProofEnabled: map.teacherPhotoProofEnabled === 'true',
    parentNotificationEnabled: map.parentNotificationEnabled === 'true',
    holidays: map.holidays ? JSON.parse(map.holidays || '[]') : [],
    foundationAddress: map.foundationAddress || 'Jl. Pesantren Mambaul Ulum No. 45, Diwek, Jombang, Jawa Timur 61471',
    foundationWebsite: map.foundationWebsite || 'https://mambaululum.sch.id',
    foundationWatermarkUrl: map.foundationWatermarkUrl || '',
    foundationQrCodeUrl: map.foundationQrCodeUrl || '',
    levelConfigsJson: map.levelConfigsJson || '',
  };
}

// Update a setting key
export async function updateSchoolSetting(key: string, value: string, updatedBy: string = 'admin'): Promise<void> {
  const now = new Date().toISOString();
  if (!isGoogleSheetsConfigured()) {
    memoryStore.Settings[key] = value;
    return;
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID!;
  if (!sheets) throw new Error('Sheets client unavailable');

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Settings'!A1:F100`,
  });

  const rows = res.data.values || [];
  let foundRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i] && rows[i][1] === key) {
      foundRowIdx = i + 1;
      break;
    }
  }

  if (foundRowIdx !== -1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Settings'!C${foundRowIdx}:F${foundRowIdx}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value, now, now, updatedBy]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Settings'!A:F`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[`set-${Date.now()}`, key, value, now, now, updatedBy]],
      },
    });
  }

  delete cacheStore['table_Settings'];
}
