export type Role = 'admin' | 'wali_kelas' | 'bk' | 'kesiswaan' | 'guru';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  name: string;
  email: string;
  classId?: string; // For homeroom teachers (wali kelas)
  isActive: boolean;
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
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type EducationLevel = 'SMA/MA' | 'SMP/MTS' | 'SD/MI';

export interface LevelConfig {
  level: EducationLevel;
  unitName: string;
  principalName: string;
  principalNip: string;
  principalSignatureUrl?: string;
  logoUrl?: string;
  websiteUrl?: string;
  qrCodeUrl?: string;
  watermarkUrl?: string;
  schoolAddress?: string;
  vision: string;
  missions: string[];
  accentColor: string;
  headerColor: string;
  badgeText: string;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "X RPL 1"
  grade: string; // "10", "11", "12"
  academicYear: string; // "2026/2027"
  level?: EducationLevel;
  homeRoomTeacherId?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  barcodeCard: string; // Scanned QR / Barcode / RFID string
  parentPhone: string;
  photoUrl?: string;
  level?: EducationLevel;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  bloodType?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FaceTemplate {
  id: string;
  personId: string; // studentId or teacherId
  personType: 'student' | 'teacher';
  descriptor: number[]; // 128 floats vector
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type StudentAttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
export type AttendanceMethod = 'FACE_SCAN' | 'MANUAL' | 'RFID_SCAN' | 'BARCODE_SCAN';

export interface StudentAttendance {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm:ss
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
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm:ss
  timeOut?: string; // HH:mm:ss
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
  date: string; // YYYY-MM-DD
  timeOut: string; // HH:mm:ss
  timeIn?: string; // HH:mm:ss
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

export interface ChangeLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: string;
  updatedBy: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolLogo: string;
  academicYear: string;
  checkInTime: string; // e.g. "07:00"
  lateCutoffTime: string; // e.g. "07:15"
  checkOutTime: string; // e.g. "15:00"
  toiletMaxMinutes: number; // e.g. 10
  warningThresholdAbsent: number; // e.g. 3
  warningThresholdLate: number; // e.g. 3
  warningThresholdToilet: number; // e.g. 5
  teacherPhotoProofEnabled: boolean;
  parentNotificationEnabled: boolean;
  holidays: string[]; // ['2026-08-17', ...]
  foundationAddress?: string;
  foundationWebsite?: string;
  foundationWatermarkUrl?: string;
  foundationQrCodeUrl?: string;
  levelConfigsJson?: string;
}

export interface FollowUpNote {
  id: string;
  studentId: string;
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

export interface DatabaseSchema {
  Settings: Record<string, string>;
  Users: User[];
  Teachers: Teacher[];
  Classes: SchoolClass[];
  Students: Student[];
  FaceTemplates: FaceTemplate[];
  StudentAttendance: StudentAttendance[];
  TeacherAttendance: TeacherAttendance[];
  ToiletPermits: ToiletPermit[];
  Locations: SchoolLocation[];
  AuditLog: AuditLog[];
  ChangeLog: ChangeLog[];
  FollowUpNotes: FollowUpNote[];
}
