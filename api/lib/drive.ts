import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import {
  getTableRecords,
  getSchoolSettings,
  isValidSyncEmail,
  isServiceAccountConfigured,
  updateSchoolSetting,
} from './db.ts';

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
    return `simulated_drive://attendance_proof_${Date.now()}.jpg`;
  }

  const drive = getGoogleDriveClient();
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!drive || !folderId) {
    throw new Error('Google Drive client is not configured');
  }

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

// Create a complete database JSON snapshot backup to Drive linked to targetEmail
export async function createDatabaseBackup(
  backupBy: string,
  targetEmail?: string,
  customFolderId?: string
): Promise<{
  success: boolean;
  cloudSynced: boolean;
  linkedEmail: string;
  folderId?: string;
  folderUrl?: string;
  fileId?: string;
  fileUrl?: string;
  fileName: string;
  sizeBytes: number;
  snapshot: Record<string, unknown>;
}> {
  const settings = await getSchoolSettings();
  const cleanEmail = (targetEmail || settings.syncTargetEmail || '').trim();
  if (!isValidSyncEmail(cleanEmail)) {
    throw new Error('Harap masukkan dan tautkan alamat email yang valid sebelum menyinkronkan ke Google Drive.');
  }

  await updateSchoolSetting('syncTargetEmail', cleanEmail, backupBy);

  const [
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
    changeLog,
    followUpNotes,
  ] = await Promise.all([
    getTableRecords('Users'),
    getTableRecords('Teachers'),
    getTableRecords('Classes'),
    getTableRecords('Students'),
    getTableRecords('FaceTemplates'),
    getTableRecords('StudentAttendance'),
    getTableRecords('TeacherAttendance'),
    getTableRecords('ToiletPermits'),
    getTableRecords('Locations'),
    getTableRecords('AuditLog'),
    getTableRecords('ChangeLog'),
    getTableRecords('FollowUpNotes'),
  ]);

  const snapshot: Record<string, unknown> = {
    linkedEmail: cleanEmail,
    exportedAt: new Date().toISOString(),
    exportedBy: backupBy,
    schoolName: settings.schoolName,
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
    changeLog,
    followUpNotes,
  };

  const jsonContent = JSON.stringify(snapshot, null, 2);
  const buffer = Buffer.from(jsonContent, 'utf-8');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeEmailTag = cleanEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `Backup_Presensi_${safeEmailTag}_${timestamp}.json`;

  if (!isServiceAccountConfigured()) {
    return {
      success: true,
      cloudSynced: false,
      linkedEmail: cleanEmail,
      fileName,
      sizeBytes: buffer.length,
      snapshot,
    };
  }

  const drive = getGoogleDriveClient();
  if (!drive) {
    throw new Error('Google Drive client unavailable');
  }

  let folderId =
    (customFolderId && customFolderId.trim()) ||
    settings.syncLinkedFolderId ||
    process.env.DRIVE_FOLDER_ID ||
    '';

  if (!folderId) {
    const folderRes = await drive.files.create({
      requestBody: {
        name: `Presensi_${settings.schoolName.replace(/\s+/g, '_')}_${cleanEmail}`,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    folderId = folderRes.data.id || '';
  }

  if (folderId) {
    try {
      await drive.permissions.create({
        fileId: folderId,
        sendNotificationEmail: false,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: cleanEmail,
        },
      });
    } catch (permErr) {
      console.warn(`Could not grant folder permission for ${cleanEmail}:`, permErr);
    }
    await updateSchoolSetting('syncLinkedFolderId', folderId, backupBy);
  }

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      ...(folderId ? { parents: [folderId] } : {}),
      mimeType: 'application/json',
      description: `Database backup aplikasi presensi ditautkan ke ${cleanEmail}`,
    },
    media: {
      mimeType: 'application/json',
      body: stream,
    },
    fields: 'id, name, size, webViewLink',
  });

  const fileId = file.data.id || undefined;
  return {
    success: true,
    cloudSynced: true,
    linkedEmail: cleanEmail,
    folderId: folderId || undefined,
    folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : undefined,
    fileId,
    fileUrl: file.data.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : undefined),
    fileName,
    sizeBytes: buffer.length,
    snapshot,
  };
}
