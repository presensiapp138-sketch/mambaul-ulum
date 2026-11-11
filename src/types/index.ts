export type Role = 'admin' | 'wali_kelas' | 'bk' | 'kesiswaan' | 'guru';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  email: string;
  classId?: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  barcodeCard: string;
  parentPhone: string;
  isActive: boolean;
  hasFaceEnrolled?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Teacher {
  id: string;
  nip: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  isActive: boolean;
  hasFaceEnrolled?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  homeRoomTeacherId?: string;
  homeRoomTeacherName?: string;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type StudentAttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
export type AttendanceMethod = 'FACE_SCAN' | 'MANUAL' | 'RFID_SCAN' | 'BARCODE_SCAN';

export interface StudentAttendance {
  id: string;
  studentId: string;
  studentName?: string;
  studentNis?: string;
  className?: string;
  classId?: string;
  date: string;
  timeIn: string;
  status: StudentAttendanceStatus;
  method: AttendanceMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type TeacherAttendanceStatus = 'Tepat Waktu' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';

export interface TeacherAttendance {
  id: string;
  teacherId: string;
  teacherName?: string;
  nip?: string;
  subject?: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  status: TeacherAttendanceStatus;
  method: AttendanceMethod;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  photoDriveUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ToiletPermit {
  id: string;
  studentId: string;
  studentName?: string;
  studentNis?: string;
  className?: string;
  date: string;
  timeOut: string;
  timeIn?: string;
  durationMinutes?: number;
  status: 'active' | 'returned';
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SchoolLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolLogo: string;
  academicYear: string;
  checkInTime: string;
  lateCutoffTime: string;
  checkOutTime: string;
  toiletMaxMinutes: number;
  warningThresholdAbsent: number;
  warningThresholdLate: number;
  warningThresholdToilet: number;
  teacherPhotoProofEnabled: boolean;
  parentNotificationEnabled: boolean;
  holidays: string[];
}

export interface FaceTemplate {
  id: string;
  personId: string;
  personType: 'student' | 'teacher';
  descriptor: number[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FollowUpNote {
  id: string;
  studentId: string;
  studentName?: string;
  studentNis?: string;
  date: string;
  category: 'Absensi' | 'Keterlambatan' | 'Toilet' | 'Perilaku' | 'Lainnya';
  notes: string;
  actionPlan: string;
  status: 'Open' | 'InProgress' | 'Resolved';
  counselorId: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ProblemStudent {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  parentPhone: string;
  alpaCount: number;
  lateCount: number;
  toiletExceededCount: number;
  totalToiletCount: number;
  warningLevel: 'KUNING' | 'MERAH';
  issues: string[];
}
