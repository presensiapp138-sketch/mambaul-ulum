import {
  getTableRecords,
  appendRecord,
  updateRecord,
  deleteRecord,
  initializeDatabase,
  getSchoolSettings,
  updateSchoolSetting,
  recordAudit,
  isGoogleSheetsConfigured,
} from './lib/db.ts';
import {
  generateToken,
  verifyToken,
  comparePassword,
  hashPassword,
  extractBearerToken,
  TokenPayload,
} from './lib/auth.ts';
import {
  isGoogleDriveConfigured,
  createDatabaseBackup,
  uploadAttendancePhoto,
} from './lib/drive.ts';
import {
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
} from './lib/types.ts';

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

// Distance helper: Haversine formula in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Format local time HH:mm:ss and YYYY-MM-DD
function getLocalTimeAndDate(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
  return { dateStr, timeStr };
}

// Main dispatcher function
export async function handleApiRoute(req: ApiRequest): Promise<ApiResponse> {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname.replace(/\/$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();
  const authHeader = (Array.isArray(req.headers['authorization'])
    ? req.headers['authorization'][0]
    : req.headers['authorization']) || '';
  const token = extractBearerToken(authHeader);
  const currentUser: TokenPayload | null = token ? verifyToken(token) : null;

  const jsonResponse = (data: unknown, statusCode = 200): ApiResponse => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: data,
  });

  const errorResponse = (message: string, statusCode = 400): ApiResponse => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: { error: message, success: false },
  });

  try {
    // --------------------------------------------------------------------------
    // 1. Health, Status & Configuration
    // --------------------------------------------------------------------------
    if (pathname === '/api/status' && method === 'GET') {
      const sheetsOk = isGoogleSheetsConfigured();
      const driveOk = isGoogleDriveConfigured();
      return jsonResponse({
        success: true,
        sheetsConfigured: sheetsOk,
        driveConfigured: driveOk,
        mode: sheetsOk ? 'Google Sheets' : 'Simulated / Memory Mode (Ready to use)',
        timestamp: new Date().toISOString(),
      });
    }

    if (pathname === '/api/sheets/init' && method === 'POST') {
      const result = await initializeDatabase();
      await recordAudit(
        currentUser?.userId || 'system',
        'INIT_DATABASE',
        'System',
        'all',
        'Inisialisasi tabel Google Sheets dan data awal.'
      );
      return jsonResponse(result);
    }

    // --------------------------------------------------------------------------
    // 2. Authentication
    // --------------------------------------------------------------------------
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { username, password } = (req.body as { username?: string; password?: string }) || {};
      if (!username || !password) {
        return errorResponse('Username dan password wajib diisi.', 400);
      }

      const users = await getTableRecords<User>('Users');
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        return errorResponse('Username atau password salah.', 401);
      }

      if (!user.isActive) {
        return errorResponse('Akun Anda dinonaktifkan oleh administrator.', 403);
      }

      const passwordValid = comparePassword(password, user.passwordHash);
      if (!passwordValid) {
        return errorResponse('Username atau password salah.', 401);
      }

      const jwtToken = generateToken(user);
      await recordAudit(user.id, 'LOGIN', 'User', user.id, `User ${user.username} (${user.role}) berhasil login.`);

      return jsonResponse({
        success: true,
        token: jwtToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          classId: user.classId,
        },
      });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      if (!currentUser) return errorResponse('Sesi tidak valid atau telah berakhir.', 401);
      const users = await getTableRecords<User>('Users');
      const user = users.find(u => u.id === currentUser.userId);
      if (!user || !user.isActive) {
        return errorResponse('Pengguna tidak ditemukan atau dinonaktifkan.', 401);
      }

      return jsonResponse({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          email: user.email,
          classId: user.classId,
        },
      });
    }

    if (pathname === '/api/auth/change-password' && method === 'POST') {
      if (!currentUser) return errorResponse('Unauthorized', 401);
      const { currentPassword, newPassword } = (req.body as { currentPassword?: string; newPassword?: string }) || {};
      if (!newPassword || newPassword.length < 5) {
        return errorResponse('Password baru minimal 5 karakter.', 400);
      }

      const users = await getTableRecords<User>('Users');
      const user = users.find(u => u.id === currentUser.userId);
      if (!user) return errorResponse('Pengguna tidak ditemukan.', 404);

      if (currentPassword && !comparePassword(currentPassword, user.passwordHash)) {
        return errorResponse('Password saat ini salah.', 400);
      }

      const newHash = hashPassword(newPassword);
      await updateRecord<User>('Users', user.id, { passwordHash: newHash }, undefined, currentUser.userId);
      await recordAudit(currentUser.userId, 'CHANGE_PASSWORD', 'User', user.id, 'Pengguna mengganti password.');

      return jsonResponse({ success: true, message: 'Password berhasil diubah.' });
    }

    // --------------------------------------------------------------------------
    // 3. Real-Time Sync & Polling Endpoint (smart diff via ChangeLog)
    // --------------------------------------------------------------------------
    if (pathname === '/api/sync' && method === 'GET') {
      const since = req.query.since ? String(req.query.since) : '';
      const changeLogs = await getTableRecords<ChangeLog>('ChangeLog');

      // Filter changes since timestamp
      const recentChanges = since
        ? changeLogs.filter(c => c.timestamp > since)
        : changeLogs.slice(-50);

      // Return core active state
      const { dateStr } = getLocalTimeAndDate();
      const allAttendance = await getTableRecords<StudentAttendance>('StudentAttendance');
      const todayAttendance = allAttendance.filter(a => a.date === dateStr);

      const allPermits = await getTableRecords<ToiletPermit>('ToiletPermits');
      const activePermits = allPermits.filter(p => p.date === dateStr && p.status === 'active');

      const settings = await getSchoolSettings();

      return jsonResponse({
        success: true,
        serverTime: new Date().toISOString(),
        todayAttendance,
        activePermits,
        settings,
        hasChanges: recentChanges.length > 0,
        changeCount: recentChanges.length,
      });
    }

    // --------------------------------------------------------------------------
    // 4. Kiosk & Student Attendance
    // --------------------------------------------------------------------------
    if (pathname === '/api/attendance/student' && method === 'POST') {
      const { studentId, barcodeCard, method: attMethod } = (req.body as {
        studentId?: string;
        barcodeCard?: string;
        method?: string;
      }) || {};

      if (!studentId && !barcodeCard) {
        return errorResponse('ID Siswa atau nomor barcode kartu wajib disertakan.', 400);
      }

      const students = await getTableRecords<Student>('Students');
      const student = students.find(
        s => (studentId && s.id === studentId) || (barcodeCard && s.barcodeCard === barcodeCard)
      );

      if (!student) {
        return errorResponse('Siswa tidak ditemukan dalam sistem.', 404);
      }

      if (!student.isActive) {
        return errorResponse(`Siswa ${student.name} berstatus tidak aktif.`, 400);
      }

      const { dateStr, timeStr } = getLocalTimeAndDate();
      const existingAttendance = await getTableRecords<StudentAttendance>('StudentAttendance');

      // Check if student already checked in today
      const alreadyCheckedIn = existingAttendance.find(
        a => a.studentId === student.id && a.date === dateStr
      );

      if (alreadyCheckedIn) {
        return errorResponse(
          `Siswa ${student.name} sudah presensi hari ini pada pukul ${alreadyCheckedIn.timeIn} (${alreadyCheckedIn.status}).`,
          409
        );
      }

      // Determine Hadir vs Terlambat based on school settings
      const settings = await getSchoolSettings();
      let status: 'Hadir' | 'Terlambat' = 'Hadir';

      if (settings.lateCutoffTime) {
        // Compare HH:mm
        const currentHHMM = timeStr.substring(0, 5);
        if (currentHHMM > settings.lateCutoffTime) {
          status = 'Terlambat';
        }
      }

      const newRecord: StudentAttendance = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        date: dateStr,
        timeIn: timeStr,
        status,
        method: (attMethod as any) || 'FACE_SCAN',
        notes: status === 'Terlambat' ? `Terlambat (melewati ${settings.lateCutoffTime})` : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'kiosk',
      };

      const saved = await appendRecord<StudentAttendance>('StudentAttendance', newRecord, 'kiosk');
      await recordAudit(
        'kiosk',
        'STUDENT_ATTENDANCE',
        'StudentAttendance',
        saved.id,
        `Presensi siswa ${student.name} (${student.nis}) - Status: ${status} pada ${timeStr}`
      );

      return jsonResponse({
        success: true,
        attendance: saved,
        student: {
          id: student.id,
          name: student.name,
          nis: student.nis,
          classId: student.classId,
        },
        message: `Presensi berhasil! Selamat datang, ${student.name}.`,
      });
    }

    // Manual Attendance (Duty officer, Homeroom, or Admin)
    if (pathname === '/api/attendance/student/manual' && method === 'POST') {
      const { studentId, status, notes, date } = (req.body as {
        studentId?: string;
        status?: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
        notes?: string;
        date?: string;
      }) || {};

      if (!studentId || !status) {
        return errorResponse('studentId dan status wajib diisi.', 400);
      }

      const students = await getTableRecords<Student>('Students');
      const student = students.find(s => s.id === studentId);
      if (!student) return errorResponse('Siswa tidak ditemukan.', 404);

      const { dateStr, timeStr } = getLocalTimeAndDate();
      const targetDate = date || dateStr;

      const existing = await getTableRecords<StudentAttendance>('StudentAttendance');
      const found = existing.find(a => a.studentId === studentId && a.date === targetDate);

      let resultRecord: StudentAttendance;
      if (found) {
        // Update existing record
        resultRecord = await updateRecord<StudentAttendance>(
          'StudentAttendance',
          found.id,
          { status, notes: notes || found.notes, method: 'MANUAL' },
          found.updatedAt,
          currentUser?.userId || 'manual-officer'
        );
      } else {
        // Create new manual record
        resultRecord = await appendRecord<StudentAttendance>(
          'StudentAttendance',
          {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            studentId,
            date: targetDate,
            timeIn: timeStr,
            status,
            method: 'MANUAL',
            notes: notes || 'Presensi Manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.userId || 'manual-officer',
          },
          currentUser?.userId || 'manual-officer'
        );
      }

      await recordAudit(
        currentUser?.userId || 'manual-officer',
        'MANUAL_ATTENDANCE',
        'StudentAttendance',
        resultRecord.id,
        `Presensi Manual siswa ${student.name} diubah menjadi ${status}. Alasan: ${notes || '-'}`
      );

      return jsonResponse({
        success: true,
        attendance: resultRecord,
        student,
        message: `Presensi manual ${student.name} berhasil disimpan.`,
      });
    }

    // Today's student attendance list
    if (pathname === '/api/attendance/today' && method === 'GET') {
      const { dateStr } = getLocalTimeAndDate();
      const targetDate = req.query.date ? String(req.query.date) : dateStr;
      const classId = req.query.classId ? String(req.query.classId) : undefined;

      const allAtt = await getTableRecords<StudentAttendance>('StudentAttendance');
      const students = await getTableRecords<Student>('Students');
      const classes = await getTableRecords<SchoolClass>('Classes');

      let records = allAtt.filter(a => a.date === targetDate);

      // Join student and class names
      const enriched = records.map(a => {
        const student = students.find(s => s.id === a.studentId);
        const cls = student ? classes.find(c => c.id === student.classId) : undefined;
        return {
          ...a,
          studentName: student?.name || 'Siswa',
          studentNis: student?.nis || '',
          className: cls?.name || '',
          classId: student?.classId || '',
        };
      });

      const filtered = classId ? enriched.filter(e => e.classId === classId) : enriched;
      // Sort newest first
      filtered.sort((a, b) => (b.timeIn || '').localeCompare(a.timeIn || ''));

      return jsonResponse({
        success: true,
        date: targetDate,
        total: filtered.length,
        data: filtered,
      });
    }

    // --------------------------------------------------------------------------
    // 5. Toilet Permit (Izin ke Toilet)
    // --------------------------------------------------------------------------
    if (pathname === '/api/toilet/start' && method === 'POST') {
      const { studentId } = (req.body as { studentId?: string }) || {};
      if (!studentId) return errorResponse('studentId wajib diisi.', 400);

      const students = await getTableRecords<Student>('Students');
      const student = students.find(s => s.id === studentId);
      if (!student) return errorResponse('Siswa tidak ditemukan.', 404);

      const { dateStr, timeStr } = getLocalTimeAndDate();
      const permits = await getTableRecords<ToiletPermit>('ToiletPermits');

      // Check if student is already in toilet
      const active = permits.find(p => p.studentId === studentId && p.date === dateStr && p.status === 'active');
      if (active) {
        return errorResponse(`Siswa ${student.name} sedang izin di toilet sejak ${active.timeOut}.`, 409);
      }

      const newPermit: ToiletPermit = {
        id: `tlt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: student.id,
        date: dateStr,
        timeOut: timeStr,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'kiosk',
      };

      const saved = await appendRecord<ToiletPermit>('ToiletPermits', newPermit, 'kiosk');
      await recordAudit('kiosk', 'TOILET_START', 'ToiletPermits', saved.id, `Siswa ${student.name} keluar ke toilet.`);

      return jsonResponse({
        success: true,
        permit: saved,
        student: { id: student.id, name: student.name, classId: student.classId },
        message: `Izin toilet tercatat untuk ${student.name}.`,
      });
    }

    if (pathname === '/api/toilet/return' && method === 'POST') {
      const { permitId, studentId } = (req.body as { permitId?: string; studentId?: string }) || {};
      const { dateStr, timeStr } = getLocalTimeAndDate();
      const permits = await getTableRecords<ToiletPermit>('ToiletPermits');

      const target = permits.find(
        p => (permitId && p.id === permitId) || (studentId && p.studentId === studentId && p.status === 'active' && p.date === dateStr)
      );

      if (!target) {
        return errorResponse('Izin toilet aktif tidak ditemukan untuk siswa ini.', 404);
      }

      // Calculate duration in minutes
      const [outH, outM, outS = 0] = target.timeOut.split(':').map(Number);
      const [inH, inM, inS = 0] = timeStr.split(':').map(Number);
      const outSeconds = outH * 3600 + outM * 60 + outS;
      const inSeconds = inH * 3600 + inM * 60 + inS;
      const durationSec = Math.max(0, inSeconds - outSeconds);
      const durationMinutes = Math.ceil(durationSec / 60);

      const updated = await updateRecord<ToiletPermit>(
        'ToiletPermits',
        target.id,
        {
          timeIn: timeStr,
          durationMinutes,
          status: 'returned',
        },
        target.updatedAt,
        'kiosk'
      );

      const settings = await getSchoolSettings();
      const exceeded = durationMinutes > settings.toiletMaxMinutes;

      await recordAudit(
        'kiosk',
        'TOILET_RETURN',
        'ToiletPermits',
        target.id,
        `Siswa kembali dari toilet setelah ${durationMinutes} menit.${exceeded ? ' (MELEBIHI BATAS)' : ''}`
      );

      return jsonResponse({
        success: true,
        permit: updated,
        durationMinutes,
        exceeded,
        maxMinutes: settings.toiletMaxMinutes,
        message: exceeded
          ? `Perhatian: Durasi ${durationMinutes} menit melebihi batas waktu (${settings.toiletMaxMinutes} menit)!`
          : `Kembali dari toilet tercatat (${durationMinutes} menit).`,
      });
    }

    if (pathname === '/api/toilet/active' && method === 'GET') {
      const { dateStr } = getLocalTimeAndDate();
      const permits = await getTableRecords<ToiletPermit>('ToiletPermits');
      const students = await getTableRecords<Student>('Students');
      const classes = await getTableRecords<SchoolClass>('Classes');

      const active = permits
        .filter(p => p.date === dateStr && p.status === 'active')
        .map(p => {
          const student = students.find(s => s.id === p.studentId);
          const cls = student ? classes.find(c => c.id === student.classId) : undefined;
          return {
            ...p,
            studentName: student?.name || 'Siswa',
            studentNis: student?.nis || '',
            className: cls?.name || '',
          };
        });

      return jsonResponse({ success: true, activePermits: active });
    }

    // --------------------------------------------------------------------------
    // 6. Teacher Attendance (Face + GPS Radius + Photo proof)
    // --------------------------------------------------------------------------
    if (pathname === '/api/attendance/teacher' && method === 'POST') {
      if (!currentUser) return errorResponse('Silakan login terlebih dahulu.', 401);

      const {
        actionType, // 'checkIn' | 'checkOut' | 'permit'
        latitude,
        longitude,
        photoBase64,
        notes,
        permitType, // 'Izin' | 'Sakit'
      } = (req.body as {
        actionType?: string;
        latitude?: number;
        longitude?: number;
        photoBase64?: string;
        notes?: string;
        permitType?: string;
      }) || {};

      const teachers = await getTableRecords<Teacher>('Teachers');
      // Match teacher with currentUser by email or name
      const teacher = teachers.find(
        t => t.email.toLowerCase() === currentUser.username.toLowerCase() ||
             t.name.toLowerCase() === currentUser.name.toLowerCase() ||
             t.id === currentUser.userId
      ) || teachers[0]; // Fallback to first teacher if testing with demo admin

      if (!teacher) {
        return errorResponse('Data profil guru tidak ditemukan.', 404);
      }

      const { dateStr, timeStr } = getLocalTimeAndDate();
      const existingAttendance = await getTableRecords<TeacherAttendance>('TeacherAttendance');
      const todayRecord = existingAttendance.find(a => a.teacherId === teacher.id && a.date === dateStr);
      const settings = await getSchoolSettings();

      // Handle Permit/Sick submission
      if (actionType === 'permit') {
        const permitStatus = permitType === 'Sakit' ? 'Sakit' : 'Izin';
        if (todayRecord) {
          await updateRecord<TeacherAttendance>(
            'TeacherAttendance',
            todayRecord.id,
            { status: permitStatus, notes: notes || permitStatus },
            todayRecord.updatedAt,
            currentUser.userId
          );
        } else {
          await appendRecord<TeacherAttendance>(
            'TeacherAttendance',
            {
              id: `tch-att-${Date.now()}`,
              teacherId: teacher.id,
              date: dateStr,
              timeIn: timeStr,
              status: permitStatus,
              method: 'MANUAL',
              notes: notes || permitStatus,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.userId,
            },
            currentUser.userId
          );
        }
        await recordAudit(currentUser.userId, 'TEACHER_PERMIT', 'TeacherAttendance', teacher.id, `Pengajuan ${permitStatus}: ${notes || '-'}`);
        return jsonResponse({ success: true, message: `Pengajuan ${permitStatus} berhasil disimpan.` });
      }

      // Check GPS Location validation
      const locations = await getTableRecords<SchoolLocation>('Locations');
      const activeLocations = locations.filter(l => l.isActive);

      if (activeLocations.length > 0 && latitude !== undefined && longitude !== undefined) {
        // Calculate nearest distance to any active school location
        let minDistance = Infinity;
        let matchedLocation: SchoolLocation | null = null;

        for (const loc of activeLocations) {
          const dist = calculateDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            matchedLocation = loc;
          }
        }

        const allowedRadius = matchedLocation?.radiusMeters || 100;
        if (minDistance > allowedRadius) {
          return errorResponse(
            `Presensi ditolak: Anda berada di luar radius sekolah (${minDistance}m dari ${matchedLocation?.name || 'lokasi sekolah'}, batas radius: ${allowedRadius}m).`,
            403
          );
        }
      }

      // Optional photo upload to Google Drive
      let photoUrl: string | undefined = undefined;
      if (settings.teacherPhotoProofEnabled && photoBase64) {
        try {
          photoUrl = await uploadAttendancePhoto(teacher.name, photoBase64);
        } catch (err) {
          console.warn('Failed to upload photo to Drive:', err);
        }
      }

      if (actionType === 'checkOut') {
        if (!todayRecord) {
          return errorResponse('Anda belum melakukan presensi masuk hari ini.', 400);
        }
        const updated = await updateRecord<TeacherAttendance>(
          'TeacherAttendance',
          todayRecord.id,
          {
            timeOut: timeStr,
            notes: notes || todayRecord.notes,
          },
          todayRecord.updatedAt,
          currentUser.userId
        );
        await recordAudit(currentUser.userId, 'TEACHER_CHECKOUT', 'TeacherAttendance', todayRecord.id, `Presensi Pulang Guru ${teacher.name} pukul ${timeStr}`);
        return jsonResponse({
          success: true,
          attendance: updated,
          message: `Presensi pulang berhasil dicatat pada ${timeStr}. Sampai jumpa besok!`,
        });
      }

      // Check In
      if (todayRecord) {
        return errorResponse(`Anda sudah melakukan presensi masuk hari ini pada pukul ${todayRecord.timeIn}.`, 409);
      }

      let status: 'Tepat Waktu' | 'Terlambat' = 'Tepat Waktu';
      if (settings.lateCutoffTime && timeStr.substring(0, 5) > settings.lateCutoffTime) {
        status = 'Terlambat';
      }

      const newAtt: TeacherAttendance = {
        id: `tch-att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        teacherId: teacher.id,
        date: dateStr,
        timeIn: timeStr,
        status,
        method: 'FACE_SCAN',
        latitude,
        longitude,
        photoDriveUrl: photoUrl,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.userId,
      };

      const saved = await appendRecord<TeacherAttendance>('TeacherAttendance', newAtt, currentUser.userId);
      await recordAudit(currentUser.userId, 'TEACHER_CHECKIN', 'TeacherAttendance', saved.id, `Presensi Masuk Guru ${teacher.name} (${status}) pukul ${timeStr}`);

      return jsonResponse({
        success: true,
        attendance: saved,
        message: `Presensi masuk berhasil dicatat! Status: ${status}.`,
      });
    }

    if (pathname === '/api/attendance/teacher/history' && method === 'GET') {
      const records = await getTableRecords<TeacherAttendance>('TeacherAttendance');
      const teachers = await getTableRecords<Teacher>('Teachers');

      const enriched = records.map(r => {
        const teacher = teachers.find(t => t.id === r.teacherId);
        return {
          ...r,
          teacherName: teacher?.name || 'Guru',
          nip: teacher?.nip || '',
          subject: teacher?.subject || '',
        };
      });

      // Filter by teacherId if requested
      const teacherId = req.query.teacherId ? String(req.query.teacherId) : undefined;
      const filtered = teacherId ? enriched.filter(e => e.teacherId === teacherId) : enriched;
      filtered.sort((a, b) => b.date.localeCompare(a.date) || (b.timeIn || '').localeCompare(a.timeIn || ''));

      return jsonResponse({ success: true, data: filtered });
    }

    // --------------------------------------------------------------------------
    // 7. Face Templates (Biometric 128 floats vector)
    // --------------------------------------------------------------------------
    if (pathname === '/api/face-templates' && method === 'GET') {
      const templates = await getTableRecords<FaceTemplate>('FaceTemplates');
      return jsonResponse({ success: true, data: templates });
    }

    if (pathname === '/api/face-templates' && method === 'POST') {
      const { personId, personType, descriptor } = (req.body as {
        personId?: string;
        personType?: 'student' | 'teacher';
        descriptor?: number[];
      }) || {};

      if (!personId || !descriptor || !Array.isArray(descriptor)) {
        return errorResponse('personId dan descriptor wajah (vektor 128 angka) wajib diisi.', 400);
      }

      // Check if template already exists for this person, replace if exists
      const existing = await getTableRecords<FaceTemplate>('FaceTemplates');
      const found = existing.find(t => t.personId === personId);

      let saved: FaceTemplate;
      if (found) {
        saved = await updateRecord<FaceTemplate>(
          'FaceTemplates',
          found.id,
          { descriptor, personType: personType || found.personType },
          found.updatedAt,
          currentUser?.userId || 'admin'
        );
      } else {
        saved = await appendRecord<FaceTemplate>(
          'FaceTemplates',
          {
            id: `face-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            personId,
            personType: personType || 'student',
            descriptor,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.userId || 'admin',
          },
          currentUser?.userId || 'admin'
        );
      }

      await recordAudit(
        currentUser?.userId || 'admin',
        'REGISTER_FACE',
        'FaceTemplate',
        personId,
        `Pendaftaran wajah berhasil untuk ${personType} (${personId}). Hanya vektor matematika yang disimpan.`
      );

      return jsonResponse({
        success: true,
        template: saved,
        message: 'Data descriptor wajah berhasil disimpan.',
      });
    }

    if (pathname.startsWith('/api/face-templates/') && method === 'DELETE') {
      const id = pathname.replace('/api/face-templates/', '');
      await deleteRecord('FaceTemplates', id, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, message: 'Template wajah berhasil dihapus.' });
    }

    // --------------------------------------------------------------------------
    // 8. Students CRUD & Bulk Import
    // --------------------------------------------------------------------------
    if (pathname === '/api/students' && method === 'GET') {
      const classId = req.query.classId ? String(req.query.classId) : undefined;
      const students = await getTableRecords<Student>('Students');
      const faceTemplates = await getTableRecords<FaceTemplate>('FaceTemplates');
      const enrolledPersonIds = new Set(faceTemplates.map(f => f.personId));

      const enriched = students.map(s => ({
        ...s,
        hasFaceEnrolled: enrolledPersonIds.has(s.id),
      }));

      const filtered = classId ? enriched.filter(s => s.classId === classId) : enriched;
      return jsonResponse({ success: true, data: filtered });
    }

    if (pathname === '/api/students' && method === 'POST') {
      const body = req.body as Partial<Student>;
      if (!body.name || !body.nis || !body.classId) {
        return errorResponse('Nama, NIS, dan Kelas wajib diisi.', 400);
      }

      const students = await getTableRecords<Student>('Students');
      if (students.some(s => s.nis === body.nis)) {
        return errorResponse(`Siswa dengan NIS ${body.nis} sudah terdaftar.`, 409);
      }

      const newStudent: Student = {
        id: `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nis: body.nis,
        nisn: body.nisn || '',
        name: body.name,
        gender: body.gender || 'L',
        classId: body.classId,
        barcodeCard: body.barcodeCard || `CARD-${body.nis}`,
        parentPhone: body.parentPhone || '',
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId || 'admin',
      };

      const saved = await appendRecord<Student>('Students', newStudent, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, student: saved });
    }

    if (pathname.startsWith('/api/students/') && method === 'PUT') {
      const id = pathname.replace('/api/students/', '');
      const body = req.body as Partial<Student>;
      const updated = await updateRecord<Student>('Students', id, body, undefined, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, student: updated });
    }

    if (pathname.startsWith('/api/students/') && method === 'DELETE') {
      const id = pathname.replace('/api/students/', '');
      await deleteRecord('Students', id, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, message: 'Siswa berhasil dihapus.' });
    }

    // Bulk Import Students with Validation Report
    if (pathname === '/api/students/bulk' && method === 'POST') {
      const { rows, classId } = (req.body as { rows?: Array<Record<string, string>>; classId?: string }) || {};
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return errorResponse('Data baris upload kosong.', 400);
      }

      const existingStudents = await getTableRecords<Student>('Students');
      const existingNisSet = new Set(existingStudents.map(s => s.nis.trim()));
      const existingNisnSet = new Set(existingStudents.filter(s => s.nisn).map(s => s.nisn.trim()));

      const successRows: Student[] = [];
      const errorRows: Array<{ rowNumber: number; data: unknown; reason: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNumber = i + 1;
        const name = (r.nama || r.name || '').trim();
        const nis = (r.nis || '').trim();
        const nisn = (r.nisn || '').trim();
        const gender = (r.gender || r.jenisKelamin || 'L').toUpperCase() === 'P' ? 'P' : 'L';
        const targetClassId = r.classId || classId || existingStudents[0]?.classId || 'cls-10-rpl-1';
        const barcode = (r.barcodeCard || r.barcode || `CARD-${nis}`).trim();
        const parentPhone = (r.parentPhone || r.noHpOrtu || '').trim();

        if (!name) {
          errorRows.push({ rowNumber, data: r, reason: 'Nama siswa kosong' });
          continue;
        }
        if (!nis) {
          errorRows.push({ rowNumber, data: r, reason: 'NIS kosong' });
          continue;
        }
        if (existingNisSet.has(nis)) {
          errorRows.push({ rowNumber, data: r, reason: `Duplikat NIS: ${nis} sudah ada di database` });
          continue;
        }
        if (nisn && existingNisnSet.has(nisn)) {
          errorRows.push({ rowNumber, data: r, reason: `Duplikat NISN: ${nisn} sudah ada di database` });
          continue;
        }

        const newStd: Student = {
          id: `std-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          nis,
          nisn,
          name,
          gender,
          classId: targetClassId,
          barcodeCard: barcode,
          parentPhone,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.userId || 'admin',
        };

        existingNisSet.add(nis);
        if (nisn) existingNisnSet.add(nisn);
        successRows.push(newStd);
      }

      // Save valid rows
      for (const std of successRows) {
        await appendRecord<Student>('Students', std, currentUser?.userId || 'admin');
      }

      await recordAudit(
        currentUser?.userId || 'admin',
        'BULK_IMPORT_STUDENTS',
        'Students',
        'bulk',
        `Import massal siswa: ${successRows.length} berhasil, ${errorRows.length} gagal.`
      );

      return jsonResponse({
        success: true,
        importedCount: successRows.length,
        errorCount: errorRows.length,
        errorRows,
        message: `Import selesai: ${successRows.length} siswa berhasil ditambahkan, ${errorRows.length} baris gagal.`,
      });
    }

    // --------------------------------------------------------------------------
    // 9. Classes & Promotion (Naik Kelas)
    // --------------------------------------------------------------------------
    if (pathname === '/api/classes' && method === 'GET') {
      const classes = await getTableRecords<SchoolClass>('Classes');
      const teachers = await getTableRecords<Teacher>('Teachers');
      const students = await getTableRecords<Student>('Students');

      const enriched = classes.map(c => {
        const teacher = teachers.find(t => t.id === c.homeRoomTeacherId);
        const studentCount = students.filter(s => s.classId === c.id && s.isActive).length;
        return {
          ...c,
          homeRoomTeacherName: teacher?.name || 'Belum ditentukan',
          studentCount,
        };
      });

      return jsonResponse({ success: true, data: enriched });
    }

    if (pathname === '/api/classes' && method === 'POST') {
      const body = req.body as Partial<SchoolClass>;
      if (!body.name || !body.grade) {
        return errorResponse('Nama kelas dan tingkat wajib diisi.', 400);
      }

      const newClass: SchoolClass = {
        id: `cls-${Date.now()}`,
        name: body.name,
        grade: body.grade,
        academicYear: body.academicYear || '2026/2027',
        homeRoomTeacherId: body.homeRoomTeacherId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId || 'admin',
      };

      const saved = await appendRecord<SchoolClass>('Classes', newClass, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, class: saved });
    }

    if (pathname.startsWith('/api/classes/') && method === 'PUT') {
      const id = pathname.replace('/api/classes/', '');
      const body = req.body as Partial<SchoolClass>;
      const updated = await updateRecord<SchoolClass>('Classes', id, body, undefined, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, class: updated });
    }

    if (pathname.startsWith('/api/classes/') && method === 'DELETE') {
      const id = pathname.replace('/api/classes/', '');
      await deleteRecord('Classes', id, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, message: 'Kelas berhasil dihapus.' });
    }

    // Class Promotion (Naik Kelas massal)
    if (pathname === '/api/classes/promote' && method === 'POST') {
      const { sourceClassId, targetClassId, action } = (req.body as {
        sourceClassId?: string;
        targetClassId?: string;
        action?: 'promote' | 'graduate';
      }) || {};

      if (!sourceClassId) return errorResponse('sourceClassId wajib dipilih.', 400);

      const students = await getTableRecords<Student>('Students');
      const targetStudents = students.filter(s => s.classId === sourceClassId && s.isActive);

      let count = 0;
      for (const std of targetStudents) {
        if (action === 'graduate') {
          await updateRecord<Student>('Students', std.id, { isActive: false }, std.updatedAt, currentUser?.userId || 'admin');
        } else if (targetClassId) {
          await updateRecord<Student>('Students', std.id, { classId: targetClassId }, std.updatedAt, currentUser?.userId || 'admin');
        }
        count++;
      }

      await recordAudit(
        currentUser?.userId || 'admin',
        'PROMOTE_CLASS',
        'Classes',
        sourceClassId,
        `Proses naik kelas / kelulusan untuk ${count} siswa dari kelas ${sourceClassId}.`
      );

      return jsonResponse({
        success: true,
        count,
        message: `Berhasil memproses ${count} siswa.`,
      });
    }

    // --------------------------------------------------------------------------
    // 10. Teachers CRUD
    // --------------------------------------------------------------------------
    if (pathname === '/api/teachers' && method === 'GET') {
      const teachers = await getTableRecords<Teacher>('Teachers');
      const faceTemplates = await getTableRecords<FaceTemplate>('FaceTemplates');
      const enrolled = new Set(faceTemplates.map(f => f.personId));

      const enriched = teachers.map(t => ({
        ...t,
        hasFaceEnrolled: enrolled.has(t.id),
      }));

      return jsonResponse({ success: true, data: enriched });
    }

    if (pathname === '/api/teachers' && method === 'POST') {
      const body = req.body as Partial<Teacher>;
      if (!body.name || !body.nip) {
        return errorResponse('Nama dan NIP guru wajib diisi.', 400);
      }

      const newTeacher: Teacher = {
        id: `tch-${Date.now()}`,
        nip: body.nip,
        name: body.name,
        email: body.email || '',
        phone: body.phone || '',
        subject: body.subject || '',
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId || 'admin',
      };

      const saved = await appendRecord<Teacher>('Teachers', newTeacher, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, teacher: saved });
    }

    if (pathname.startsWith('/api/teachers/') && method === 'PUT') {
      const id = pathname.replace('/api/teachers/', '');
      const body = req.body as Partial<Teacher>;
      const updated = await updateRecord<Teacher>('Teachers', id, body, undefined, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, teacher: updated });
    }

    if (pathname.startsWith('/api/teachers/') && method === 'DELETE') {
      const id = pathname.replace('/api/teachers/', '');
      await deleteRecord('Teachers', id, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, message: 'Guru berhasil dihapus.' });
    }

    // --------------------------------------------------------------------------
    // 11. Locations (GPS Geofence points)
    // --------------------------------------------------------------------------
    if (pathname === '/api/locations' && method === 'GET') {
      const locations = await getTableRecords<SchoolLocation>('Locations');
      return jsonResponse({ success: true, data: locations });
    }

    if (pathname === '/api/locations' && method === 'POST') {
      const body = req.body as Partial<SchoolLocation>;
      if (!body.name || body.latitude === undefined || body.longitude === undefined) {
        return errorResponse('Nama lokasi, latitude, dan longitude wajib diisi.', 400);
      }

      const newLoc: SchoolLocation = {
        id: `loc-${Date.now()}`,
        name: body.name,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        radiusMeters: Number(body.radiusMeters) || 100,
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId || 'admin',
      };

      const saved = await appendRecord<SchoolLocation>('Locations', newLoc, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, location: saved });
    }

    if (pathname.startsWith('/api/locations/') && method === 'PUT') {
      const id = pathname.replace('/api/locations/', '');
      const body = req.body as Partial<SchoolLocation>;
      const updated = await updateRecord<SchoolLocation>('Locations', id, body, undefined, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, location: updated });
    }

    if (pathname.startsWith('/api/locations/') && method === 'DELETE') {
      const id = pathname.replace('/api/locations/', '');
      await deleteRecord('Locations', id, currentUser?.userId || 'admin');
      return jsonResponse({ success: true, message: 'Lokasi berhasil dihapus.' });
    }

    // --------------------------------------------------------------------------
    // 12. Settings & School Profile
    // --------------------------------------------------------------------------
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = await getSchoolSettings();
      return jsonResponse({ success: true, data: settings });
    }

    if (pathname === '/api/settings' && method === 'PUT') {
      const body = req.body as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await updateSchoolSetting(key, valStr, currentUser?.userId || 'admin');
      }

      await recordAudit(currentUser?.userId || 'admin', 'UPDATE_SETTINGS', 'Settings', 'global', 'Pengaturan sekolah diperbarui.');
      const updated = await getSchoolSettings();
      return jsonResponse({ success: true, data: updated, message: 'Pengaturan berhasil disimpan.' });
    }

    // --------------------------------------------------------------------------
    // 13. Users Management (Admin, Wali Kelas, BK, Kesiswaan, Guru)
    // --------------------------------------------------------------------------
    if (pathname === '/api/users' && method === 'GET') {
      const users = await getTableRecords<User>('Users');
      // Hide passwordHash in response
      const sanitized = users.map(({ passwordHash, ...rest }) => rest);
      return jsonResponse({ success: true, data: sanitized });
    }

    if (pathname === '/api/users' && method === 'POST') {
      const body = req.body as {
        username?: string;
        password?: string;
        role?: any;
        name?: string;
        email?: string;
        classId?: string;
      };

      if (!body.username || !body.password || !body.name || !body.role) {
        return errorResponse('Username, password, nama, dan role wajib diisi.', 400);
      }

      const users = await getTableRecords<User>('Users');
      if (users.some(u => u.username.toLowerCase() === body.username!.toLowerCase())) {
        return errorResponse('Username sudah digunakan.', 409);
      }

      const newUser: User = {
        id: `usr-${Date.now()}`,
        username: body.username,
        passwordHash: hashPassword(body.password),
        role: body.role,
        name: body.name,
        email: body.email || '',
        classId: body.classId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.userId || 'admin',
      };

      const saved = await appendRecord<User>('Users', newUser, currentUser?.userId || 'admin');
      const { passwordHash, ...safe } = saved;
      return jsonResponse({ success: true, user: safe });
    }

    if (pathname.startsWith('/api/users/') && pathname.endsWith('/password') && method === 'PUT') {
      const id = pathname.replace('/api/users/', '').replace('/password', '');
      const { newPassword } = (req.body as { newPassword?: string }) || {};
      if (!newPassword || newPassword.length < 5) {
        return errorResponse('Password minimal 5 karakter.', 400);
      }

      await updateRecord<User>('Users', id, { passwordHash: hashPassword(newPassword) }, undefined, currentUser?.userId || 'admin');
      await recordAudit(currentUser?.userId || 'admin', 'RESET_USER_PASSWORD', 'User', id, 'Reset password user oleh admin.');
      return jsonResponse({ success: true, message: 'Password user berhasil direset.' });
    }

    if (pathname.startsWith('/api/users/') && method === 'PUT') {
      const id = pathname.replace('/api/users/', '');
      const body = req.body as Partial<User>;
      delete body.passwordHash; // Don't allow raw hash update here

      const updated = await updateRecord<User>('Users', id, body, undefined, currentUser?.userId || 'admin');
      const { passwordHash, ...safe } = updated;
      return jsonResponse({ success: true, user: safe });
    }

    // --------------------------------------------------------------------------
    // 14. Rekap & Reports (Daily, Weekly, Monthly, Inter-Month Comparison)
    // --------------------------------------------------------------------------
    if (pathname === '/api/reports/recap' && method === 'GET') {
      const classId = req.query.classId ? String(req.query.classId) : undefined;
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const month1 = req.query.month1 ? String(req.query.month1) : undefined; // YYYY-MM
      const month2 = req.query.month2 ? String(req.query.month2) : undefined; // YYYY-MM

      const students = await getTableRecords<Student>('Students');
      const attendance = await getTableRecords<StudentAttendance>('StudentAttendance');
      const classes = await getTableRecords<SchoolClass>('Classes');

      const targetStudents = classId ? students.filter(s => s.classId === classId && s.isActive) : students.filter(s => s.isActive);

      // Student summary calculations
      const studentSummaries = targetStudents.map(student => {
        let studentAtt = attendance.filter(a => a.studentId === student.id);
        if (startDate && endDate) {
          studentAtt = studentAtt.filter(a => a.date >= startDate && a.date <= endDate);
        }

        const hadir = studentAtt.filter(a => a.status === 'Hadir').length;
        const terlambat = studentAtt.filter(a => a.status === 'Terlambat').length;
        const izin = studentAtt.filter(a => a.status === 'Izin').length;
        const sakit = studentAtt.filter(a => a.status === 'Sakit').length;
        const alpa = studentAtt.filter(a => a.status === 'Alpa').length;
        const totalRecorded = studentAtt.length;
        const presentTotal = hadir + terlambat;
        const attendanceRate = totalRecorded > 0 ? Math.round((presentTotal / totalRecorded) * 100) : 100;

        const cls = classes.find(c => c.id === student.classId);

        return {
          studentId: student.id,
          studentName: student.name,
          nis: student.nis,
          className: cls?.name || '',
          classId: student.classId,
          hadir,
          terlambat,
          izin,
          sakit,
          alpa,
          totalRecorded,
          presentTotal,
          attendanceRate,
          recentRecords: studentAtt.slice(-10),
        };
      });

      // Class comparison summaries
      const classSummaries = classes.map(cls => {
        const classStds = students.filter(s => s.classId === cls.id && s.isActive);
        const stdIds = new Set(classStds.map(s => s.id));
        let classAtt = attendance.filter(a => stdIds.has(a.studentId));
        if (startDate && endDate) {
          classAtt = classAtt.filter(a => a.date >= startDate && a.date <= endDate);
        }

        const hadir = classAtt.filter(a => a.status === 'Hadir').length;
        const terlambat = classAtt.filter(a => a.status === 'Terlambat').length;
        const izin = classAtt.filter(a => a.status === 'Izin').length;
        const sakit = classAtt.filter(a => a.status === 'Sakit').length;
        const alpa = classAtt.filter(a => a.status === 'Alpa').length;
        const total = classAtt.length;
        const attendanceRate = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 100;

        return {
          classId: cls.id,
          className: cls.name,
          grade: cls.grade,
          totalStudents: classStds.length,
          hadir,
          terlambat,
          izin,
          sakit,
          alpa,
          attendanceRate,
        };
      });

      // Inter-Month comparison if requested
      let monthComparison: unknown = null;
      if (month1 && month2) {
        const getMonthStats = (ym: string) => {
          const monthAtt = attendance.filter(a => a.date.startsWith(ym));
          return {
            month: ym,
            totalRecords: monthAtt.length,
            hadir: monthAtt.filter(a => a.status === 'Hadir').length,
            terlambat: monthAtt.filter(a => a.status === 'Terlambat').length,
            izin: monthAtt.filter(a => a.status === 'Izin').length,
            sakit: monthAtt.filter(a => a.status === 'Sakit').length,
            alpa: monthAtt.filter(a => a.status === 'Alpa').length,
          };
        };
        monthComparison = {
          month1: getMonthStats(month1),
          month2: getMonthStats(month2),
        };
      }

      return jsonResponse({
        success: true,
        studentSummaries,
        classSummaries,
        monthComparison,
      });
    }

    // --------------------------------------------------------------------------
    // 15. BK & Kesiswaan Problem Students Radar
    // --------------------------------------------------------------------------
    if (pathname === '/api/reports/radar' && method === 'GET') {
      const settings = await getSchoolSettings();
      const students = await getTableRecords<Student>('Students');
      const attendance = await getTableRecords<StudentAttendance>('StudentAttendance');
      const permits = await getTableRecords<ToiletPermit>('ToiletPermits');
      const classes = await getTableRecords<SchoolClass>('Classes');

      const threshAbsent = settings.warningThresholdAbsent || 3;
      const threshLate = settings.warningThresholdLate || 3;
      const threshToilet = settings.warningThresholdToilet || 4;

      const problemList = [];

      for (const std of students.filter(s => s.isActive)) {
        const stdAtt = attendance.filter(a => a.studentId === std.id);
        const alpaCount = stdAtt.filter(a => a.status === 'Alpa').length;
        const lateCount = stdAtt.filter(a => a.status === 'Terlambat').length;

        const stdPermits = permits.filter(p => p.studentId === std.id);
        const toiletExceededCount = stdPermits.filter(p => (p.durationMinutes || 0) > settings.toiletMaxMinutes).length;
        const totalToiletCount = stdPermits.length;

        const isProblem =
          alpaCount >= threshAbsent ||
          lateCount >= threshLate ||
          toiletExceededCount >= threshToilet ||
          totalToiletCount >= threshToilet * 2;

        if (isProblem) {
          const cls = classes.find(c => c.id === std.classId);
          let warningLevel: 'KUNING' | 'MERAH' = 'KUNING';
          if (alpaCount >= threshAbsent * 2 || lateCount >= threshLate * 2 || toiletExceededCount >= threshToilet * 2) {
            warningLevel = 'MERAH';
          }

          const issues: string[] = [];
          if (alpaCount >= threshAbsent) issues.push(`Alpa (${alpaCount}x)`);
          if (lateCount >= threshLate) issues.push(`Terlambat (${lateCount}x)`);
          if (toiletExceededCount >= threshToilet) issues.push(`Durasi Toilet Lewat Batas (${toiletExceededCount}x)`);
          if (totalToiletCount >= threshToilet * 2) issues.push(`Frekuensi Izin Toilet Tinggi (${totalToiletCount}x)`);

          problemList.push({
            studentId: std.id,
            studentName: std.name,
            nis: std.nis,
            className: cls?.name || '',
            parentPhone: std.parentPhone,
            alpaCount,
            lateCount,
            toiletExceededCount,
            totalToiletCount,
            warningLevel,
            issues,
          });
        }
      }

      // Sort by warning level MERAH first
      problemList.sort((a, b) => (b.warningLevel === 'MERAH' ? 1 : -1));

      return jsonResponse({
        success: true,
        thresholds: { threshAbsent, threshLate, threshToilet },
        totalProblemStudents: problemList.length,
        data: problemList,
      });
    }

    // --------------------------------------------------------------------------
    // 16. Counseling Notes (Catatan Tindak Lanjut BK)
    // --------------------------------------------------------------------------
    if (pathname === '/api/counseling/notes' && method === 'GET') {
      const studentId = req.query.studentId ? String(req.query.studentId) : undefined;
      const notes = await getTableRecords<FollowUpNote>('FollowUpNotes');
      const students = await getTableRecords<Student>('Students');

      const enriched = notes.map(n => {
        const student = students.find(s => s.id === n.studentId);
        return {
          ...n,
          studentName: student?.name || 'Siswa',
          studentNis: student?.nis || '',
        };
      });

      const filtered = studentId ? enriched.filter(e => e.studentId === studentId) : enriched;
      filtered.sort((a, b) => b.date.localeCompare(a.date));
      return jsonResponse({ success: true, data: filtered });
    }

    if (pathname === '/api/counseling/notes' && method === 'POST') {
      if (!currentUser) return errorResponse('Unauthorized', 401);
      const body = req.body as Partial<FollowUpNote>;
      if (!body.studentId || !body.notes) {
        return errorResponse('studentId dan catatan wajib diisi.', 400);
      }

      const { dateStr } = getLocalTimeAndDate();
      const newNote: FollowUpNote = {
        id: `note-${Date.now()}`,
        studentId: body.studentId,
        date: body.date || dateStr,
        category: body.category || 'Absensi',
        notes: body.notes,
        actionPlan: body.actionPlan || '',
        status: body.status || 'Open',
        counselorId: currentUser.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.userId,
      };

      const saved = await appendRecord<FollowUpNote>('FollowUpNotes', newNote, currentUser.userId);
      await recordAudit(currentUser.userId, 'CREATE_COUNSELING_NOTE', 'FollowUpNotes', saved.id, `Catatan BK untuk siswa ${body.studentId}`);
      return jsonResponse({ success: true, note: saved });
    }

    if (pathname.startsWith('/api/counseling/notes/') && method === 'PUT') {
      const id = pathname.replace('/api/counseling/notes/', '');
      const body = req.body as Partial<FollowUpNote>;
      const updated = await updateRecord<FollowUpNote>('FollowUpNotes', id, body, undefined, currentUser?.userId || 'counselor');
      return jsonResponse({ success: true, note: updated });
    }

    // --------------------------------------------------------------------------
    // 17. Backup & Audit Log
    // --------------------------------------------------------------------------
    if (pathname === '/api/backup' && method === 'POST') {
      if (!currentUser || currentUser.role !== 'admin') {
        return errorResponse('Hanya admin yang dapat membuat backup.', 403);
      }

      const backupRes = await createDatabaseBackup(currentUser.username);
      await recordAudit(currentUser.userId, 'CREATE_BACKUP', 'System', 'backup', `Database backup dibuat: ${backupRes.fileName}`);
      return jsonResponse({
        ...backupRes,
        message: backupRes.fileId
          ? 'Backup berhasil disimpan ke Google Drive!'
          : 'Backup JSON berhasil digenerate!',
      });
    }

    if (pathname === '/api/audit-log' && method === 'GET') {
      const logs = await getTableRecords<AuditLog>('AuditLog');
      // Sort newest first
      const sorted = [...logs].reverse().slice(0, 100);
      return jsonResponse({ success: true, data: sorted });
    }

    return errorResponse(`Route not found: ${method} ${pathname}`, 404);
  } catch (err: any) {
    console.error(`API Error on ${method} ${pathname}:`, err);
    return errorResponse(err.message || 'Terjadi kesalahan pada server.', 500);
  }
}
