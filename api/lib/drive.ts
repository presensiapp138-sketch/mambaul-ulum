import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { DatabaseSchema } from './types.ts';
import { getTableRecords, getSchoolSettings } from './db.ts';

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.DRIVE_FOLDER_ID
  );
}

function getGoogleDriveClient(): drive_v3.Drive | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKey) return null;

  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// Upload base64 image (teacher proof) to Google Drive folder
export async function uploadAttendancePhoto(
  teacherName: string,
  base64Data: string
): Promise<string> {
  if (!isGoogleDriveConfigured()) {
    // Return a data URL simulation or placeholder
    return `simulated_drive://attendance_proof_${Date.now()}.jpg`;
  }

  const drive = getGoogleDriveClient();
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!drive || !folderId) {
    throw new Error('Google Drive client is not configured');
  }

  // Clean base64 header if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `Presensi_${teacherName.replace(/\s+/g, '_')}_${timestamp}.jpg`;

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'image/jpeg',
    },
    media: {
      mimeType: 'image/jpeg',
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  return file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`;
}

// Create a complete database JSON snapshot backup to Drive
export async function createDatabaseBackup(backupBy: string): Promise<{ success: boolean; fileId?: string; fileName: string; sizeBytes: number }> {
  const settings = await getSchoolSettings();
  const users = await getTableRecords('Users');
  const teachers = await getTableRecords('Teachers');
  const classes = await getTableRecords('Classes');
  const students = await getTableRecords('Students');
  const faceTemplates = await getTableRecords('FaceTemplates');
  const studentAttendance = await getTableRecords('StudentAttendance');
  const teacherAttendance = await getTableRecords('TeacherAttendance');
  const toiletPermits = await getTableRecords('ToiletPermits');
  const locations = await getTableRecords('Locations');
  const auditLog = await getTableRecords('AuditLog');
  const followUpNotes = await getTableRecords('FollowUpNotes');

  const snapshot: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportedBy: backupBy,
    settings,
    users,
    teachers,
    classes,
    students,
    faceTemplates,
    studentAttendance,
    teacherAttendance,
    toiletPermits,
    locations,
    auditLog,
    followUpNotes,
  };

  const jsonContent = JSON.stringify(snapshot, null, 2);
  const buffer = Buffer.from(jsonContent, 'utf-8');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `Backup_Presensi_${timestamp}.json`;

  if (!isGoogleDriveConfigured()) {
    return {
      success: true,
      fileName,
      sizeBytes: buffer.length,
    };
  }

  const drive = getGoogleDriveClient();
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!drive || !folderId) {
    throw new Error('Google Drive is not configured');
  }

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json',
    },
    media: {
      mimeType: 'application/json',
      body: stream,
    },
    fields: 'id, name, size',
  });

  return {
    success: true,
    fileId: file.data.id || undefined,
    fileName,
    sizeBytes: buffer.length,
  };
}
