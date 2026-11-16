export interface WorkspaceExportBundle {
  linkedEmail: string;
  exportedAt: string;
  exportedBy: string;
  tableCounts: Record<string, number>;
  tablesData: Record<string, Record<string, unknown>[]>;
  sheetsRows: Record<string, string[][]>;
}

export interface WorkspaceSyncResult {
  folderId: string;
  folderUrl: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  backupFileId?: string;
  backupFileUrl?: string;
  backupFileName: string;
  sheetsSynced: string[];
  linkedEmail: string;
}

async function googleFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Google API HTTP ${res.status}`;
    const err = new Error(msg);
    (err as any).statusCode = res.status;
    throw err;
  }
  return data;
}

async function ensureDriveFolder(
  accessToken: string,
  folderName: string,
  preferredFolderId?: string
): Promise<string> {
  if (preferredFolderId) {
    try {
      const existing = await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(preferredFolderId)}?fields=id,name,trashed`,
        accessToken
      );
      if (existing?.id && !existing.trashed) {
        return existing.id;
      }
    } catch {
      // Fall back to searching/creating folder if provided ID is inaccessible
    }
  }

  const query = encodeURIComponent(
    `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    accessToken
  );

  if (Array.isArray(searchRes?.files) && searchRes.files.length > 0) {
    return searchRes.files[0].id;
  }

  const created = await googleFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  return created.id;
}

async function uploadBackupJsonToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  bundle: WorkspaceExportBundle
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Backup lengkap 13 tabel database aplikasi presensi ditautkan ke ${bundle.linkedEmail}`,
  };

  const boundary = `presensi_boundary_${Date.now()}`;
  const jsonBody = JSON.stringify(bundle, null, 2);
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonBody,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gagal mengunggah backup ke Google Drive (HTTP ${res.status})`);
  }

  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

async function ensureSpreadsheet(
  accessToken: string,
  folderId: string,
  title: string,
  sheetNames: string[],
  preferredSpreadsheetId?: string
): Promise<{ spreadsheetId: string; existingTitles: string[] }> {
  if (preferredSpreadsheetId) {
    try {
      const meta = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(preferredSpreadsheetId)}?fields=spreadsheetId,sheets.properties.title`,
        accessToken
      );
      if (meta?.spreadsheetId) {
        const titles = (meta.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
        return { spreadsheetId: meta.spreadsheetId, existingTitles: titles };
      }
    } catch {
      // Fall back to searching/creating spreadsheet
    }
  }

  const query = encodeURIComponent(
    `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  );
  const searchRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    accessToken
  );

  if (Array.isArray(searchRes?.files) && searchRes.files.length > 0) {
    const foundId = searchRes.files[0].id;
    const meta = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(foundId)}?fields=spreadsheetId,sheets.properties.title`,
      accessToken
    );
    const titles = (meta.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
    return { spreadsheetId: foundId, existingTitles: titles };
  }

  const created = await googleFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title },
        sheets: sheetNames.map(name => ({
          properties: { title: name, gridProperties: { rowCount: 2000, columnCount: 22 } },
        })),
      }),
    }
  );

  const spreadsheetId = created.spreadsheetId;

  // Move newly created spreadsheet inside the dedicated Drive folder
  try {
    const fileInfo = await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents`,
      accessToken
    );
    const prevParents = Array.isArray(fileInfo.parents) ? fileInfo.parents.join(',') : '';
    await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?addParents=${encodeURIComponent(folderId)}${prevParents ? `&removeParents=${encodeURIComponent(prevParents)}` : ''}`,
      accessToken,
      { method: 'PATCH' }
    );
  } catch (moveErr) {
    console.warn('Could not move spreadsheet to folder:', moveErr);
  }

  return { spreadsheetId, existingTitles: sheetNames };
}

export async function syncAllDatabaseToGoogleWorkspace(params: {
  accessToken: string;
  targetEmail: string;
  schoolName?: string;
  existingFolderId?: string;
  existingSpreadsheetId?: string;
  exportBundle: WorkspaceExportBundle;
}): Promise<WorkspaceSyncResult> {
  const {
    accessToken,
    targetEmail,
    schoolName = 'Yayasan_Mambaul_Ulum',
    existingFolderId,
    existingSpreadsheetId,
    exportBundle,
  } = params;

  const cleanSchool = schoolName.replace(/\s+/g, '_');
  const folderName = `Presensi_${cleanSchool}`;
  const spreadsheetTitle = `Database_${cleanSchool}_${targetEmail}`;
  const sheetNames = Object.keys(exportBundle.sheetsRows);

  // 1. Ensure Drive folder
  const folderId = await ensureDriveFolder(accessToken, folderName, existingFolderId);

  // 2. Upload JSON database backup to Drive folder
  const safeEmail = targetEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `Backup_Presensi_${safeEmail}_${dateTag}.json`;
  const driveBackup = await uploadBackupJsonToDrive(accessToken, folderId, backupFileName, exportBundle);

  // 3. Ensure Spreadsheet & all 13 sheet tabs
  const { spreadsheetId, existingTitles } = await ensureSpreadsheet(
    accessToken,
    folderId,
    spreadsheetTitle,
    sheetNames,
    existingSpreadsheetId
  );

  const missingSheets = sheetNames.filter(name => !existingTitles.includes(name));
  if (missingSheets.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: missingSheets.map(title => ({
            addSheet: {
              properties: { title, gridProperties: { rowCount: 2000, columnCount: 22 } },
            },
          })),
        }),
      }
    );
  }

  // 4. Clear and sync all 13 tables to Google Sheets
  for (const sheetName of sheetNames) {
    const rows = exportBundle.sheetsRows[sheetName];
    const clearRange = encodeURIComponent(`'${sheetName}'!A:Z`);
    const updateRange = encodeURIComponent(`'${sheetName}'!A1`);

    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${clearRange}:clear`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=RAW`,
      accessToken,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      }
    );
  }

  return {
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    backupFileId: driveBackup.id,
    backupFileUrl: driveBackup.webViewLink,
    backupFileName,
    sheetsSynced: sheetNames,
    linkedEmail: targetEmail,
  };
}
