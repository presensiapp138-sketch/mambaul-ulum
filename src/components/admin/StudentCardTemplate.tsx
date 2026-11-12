import React from 'react';
import { Student, SchoolClass, EducationLevel, LevelConfig } from '../../types/index.ts';
import { generateBarcodeSvg } from '../../lib/barcodeGenerator.ts';

export const DEFAULT_LEVEL_CONFIGS: Record<EducationLevel, LevelConfig> = {
  'SMA/MA': {
    level: 'SMA/MA',
    unitName: 'SMA / MA MAMBAUL ULUM',
    principalName: 'Drs. H. Ahmad Fauzi, M.Pd.I',
    principalNip: 'NIY. 19780512 200501 1 003',
    websiteUrl: 'https://sma.mambaululum.sch.id',
    schoolAddress: 'Jl. Pesantren Mambaul Ulum Gedung A, Diwek, Jombang',
    vision: "Terwujudnya Generasi Qur'ani, Berakhlakul Karimah, Unggul dalam IPTEK dan Berdaya Saing Global.",
    missions: [
      'Menyeimbangkan pendidikan sains modern dan pendalaman kitab kuning.',
      'Mengembangkan potensi riset ilmiah, tahfidz, dan bahasa internasional.',
      'Membentuk kepemimpinan santri yang mandiri, kritis, dan berintegritas tinggi.'
    ],
    accentColor: '#1e40af', // Blue-800
    headerColor: '#1e3a8a',
    badgeText: 'JENJANG MENENGAH ATAS'
  },
  'SMP/MTS': {
    level: 'SMP/MTS',
    unitName: 'SMP / MTs MAMBAUL ULUM',
    principalName: 'Hj. Siti Masruroh, S.Ag., M.Pd.',
    principalNip: 'NIY. 19820315 200801 2 004',
    websiteUrl: 'https://smp.mambaululum.sch.id',
    schoolAddress: 'Jl. Pesantren Mambaul Ulum Gedung B, Diwek, Jombang',
    vision: "Membentuk Insan Beriman, Berbudi Pekerti Luhur, Cerdas, dan Terampil Berlandaskan Aswaja.",
    missions: [
      'Menanamkan nilai-nilai keislaman dan pembiasaan ibadah praktis harian.',
      'Melaksanakan pembelajaran interaktif, berkarakter, dan ramah anak.',
      'Mendorong prestasi akademik, tahfidz Al-Qur\'an, dan keolahragaan.'
    ],
    accentColor: '#065f46', // Emerald-800
    headerColor: '#064e3b',
    badgeText: 'JENJANG MENENGAH PERTAMA'
  },
  'SD/MI': {
    level: 'SD/MI',
    unitName: 'SD / MI MAMBAUL ULUM',
    principalName: 'Muhammad Ridwan, S.Pd.I',
    principalNip: 'NIY. 19880720 201201 1 005',
    websiteUrl: 'https://sd.mambaululum.sch.id',
    schoolAddress: 'Jl. Pesantren Mambaul Ulum Gedung C, Diwek, Jombang',
    vision: "Ceria, Berkarakter Islami, Gemar Membaca Al-Qur'an dan Cinta Lingkungan.",
    missions: [
      'Menanamkan pondasi aqidah dan akhlak mulia sejak usia dini.',
      'Menumbuhkan kecintaan membaca Al-Qur\'an dan literasi dasar.',
      'Menciptakan lingkungan madrasah yang asri, aman, dan penuh kasih sayang.'
    ],
    accentColor: '#991b1b', // Red-800
    headerColor: '#7f1d1d',
    badgeText: 'JENJANG PENDIDIKAN DASAR'
  }
};

// Official Seal Stamp SVG
export const FoundationSealSvg: React.FC<{ color?: string }> = ({ color = '#047857' }) => (
  <svg viewBox="0 0 100 100" className="w-14 h-14 opacity-85 select-none pointer-events-none">
    <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="3 1.5" />
    <circle cx="50" cy="50" r="41" fill="none" stroke={color} strokeWidth="1.5" />
    <circle cx="50" cy="50" r="28" fill="none" stroke={color} strokeWidth="1.2" />
    <path id="curveTop" d="M 18,50 A 32,32 0 0,1 82,50" fill="none" />
    <path id="curveBottom" d="M 82,50 A 32,32 0 0,1 18,50" fill="none" />
    <text fill={color} fontSize="6.8" fontWeight="bold" letterSpacing="0.8">
      <textPath href="#curveTop" startOffset="50%" textAnchor="middle">
        YAYASAN MAMBAUL ULUM
      </textPath>
    </text>
    <text fill={color} fontSize="6.2" fontWeight="bold" letterSpacing="0.6">
      <textPath href="#curveBottom" startOffset="50%" textAnchor="middle">
        ★ RESMI TERAKREDITASI ★
      </textPath>
    </text>
    {/* Center Star & Book */}
    <polygon points="50,38 53,44 60,45 55,49 56,56 50,52 44,56 45,49 40,45 47,44" fill={color} opacity="0.9" />
  </svg>
);

// Principal Calligraphic Signature SVG
export const PrincipalSignatureSvg: React.FC<{ color?: string }> = ({ color = '#1e3a8a' }) => (
  <svg viewBox="0 0 140 45" className="w-24 h-9 select-none pointer-events-none">
    <path
      d="M10,32 Q25,8 42,22 T70,18 Q90,5 105,25 Q120,40 135,15 M38,20 L65,36 M85,15 Q95,30 115,20"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.92"
    />
  </svg>
);

// School Emblem SVG
export const SchoolEmblemSvg: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <div className={`${className} rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-700 p-0.5 shadow-sm flex items-center justify-center flex-shrink-0`}>
    <div className="w-full h-full rounded-full bg-white flex items-center justify-center border border-amber-300">
      <svg viewBox="0 0 36 36" className="w-7 h-7 text-emerald-700" fill="currentColor">
        <path d="M18 3L4 9v7c0 8.5 6 16.5 14 18 8-1.5 14-9.5 14-18V9L18 3zm0 4.5l9 3.8v4.7c0 6-4 11.5-9 13-5-1.5-9-7-9-13v-4.7l9-3.8z" />
        <path d="M18 10l-4 4h3v5h2v-5h3l-4-4zm-4 11h8v1.5h-8V21z" fill="#047857" />
      </svg>
    </div>
  </div>
);

// Helper to determine student photo url (fallback to clean avatar if none)
export function getStudentPhotoUrl(student: Student): string {
  if (student.photoUrl && student.photoUrl.trim().length > 10) {
    return student.photoUrl;
  }
  const isFemale = student.gender === 'P';
  const bg = isFemale ? 'fbcfe8' : 'bfdbfe';
  const nameInitial = encodeURIComponent(student.name);
  return `https://ui-avatars.com/api/?name=${nameInitial}&background=${bg}&color=1e3a8a&size=256&bold=true&font-size=0.45`;
}

interface StudentCardProps {
  student: Student;
  schoolClass?: SchoolClass;
  schoolName: string;
  schoolAddress?: string;
  foundationWebsite?: string;
  watermarkUrl?: string;
  hasFaceEnrolled?: boolean;
  config?: LevelConfig;
  cardSide?: 'front' | 'back';
}

// ============================================================================
// 1. SISI DEPAN KARTU PELAJAR (FRONT SIDE)
// ============================================================================
export const StudentCardFront: React.FC<StudentCardProps> = ({
  student,
  schoolClass,
  schoolName,
  schoolAddress,
  watermarkUrl,
  hasFaceEnrolled = false,
  config = DEFAULT_LEVEL_CONFIGS['SMA/MA'],
}) => {
  const barcodeValue = student.nisn || student.barcodeCard || student.nis;
  const barcodeSvg = generateBarcodeSvg(barcodeValue, 34);
  const photoUrl = getStudentPhotoUrl(student);
  const activeWatermark = config.watermarkUrl || watermarkUrl;

  return (
    <div
      id={`card-front-${student.id}`}
      style={{
        width: '425px',
        height: '272px',
        backgroundColor: '#ffffff',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      className="relative rounded-2xl overflow-hidden border-2 border-slate-300 shadow-xl flex flex-col justify-between select-none text-slate-800"
    >
      {/* Dynamic Watermark Background (Auto-adjusting) */}
      {activeWatermark ? (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
          <img
            src={activeWatermark}
            alt="Watermark"
            className="w-56 h-56 object-contain opacity-[0.08] select-none pointer-events-none filter grayscale"
          />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] flex items-center justify-center z-0">
          <svg viewBox="0 0 100 100" className="w-64 h-64" fill="currentColor">
            <circle cx="50" cy="50" r="45" />
          </svg>
        </div>
      )}

      {/* Top Header Bar */}
      <div
        style={{ backgroundColor: config.headerColor }}
        className="px-3.5 py-2 text-white flex items-center justify-between border-b-2 border-amber-400 relative z-10"
      >
        <div className="flex items-center gap-2.5">
          {/* Custom Uploaded Logo or Default Emblem */}
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              className="w-9 h-9 object-contain rounded-full bg-white p-0.5 border border-amber-300 shadow-xs flex-shrink-0"
            />
          ) : (
            <SchoolEmblemSvg className="w-9 h-9" />
          )}

          <div className="leading-tight">
            <div className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
              {schoolName.toUpperCase()}
            </div>
            <div className="text-xs font-black tracking-tight">{config.unitName}</div>
            <div className="text-[7.5px] text-blue-100 opacity-90 truncate max-w-[210px]">
              {config.schoolAddress || schoolAddress || 'Jl. Pesantren Mambaul Ulum, Diwek, Jombang • Terakreditasi "A"'}
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 shadow-xs">
            {config.level}
          </span>
          <span className="text-[7.5px] text-blue-200 mt-0.5 font-semibold">KARTU PELAJAR</span>
        </div>
      </div>

      {/* Center Body: Student Photo + Info Table + Principal Signature */}
      <div className="px-3.5 py-1.5 flex items-start gap-3 flex-1 relative z-10">
        {/* Student Portrait Box with Formal Blue Background (Standar Pas Foto Biru) */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            style={{ backgroundColor: '#1e40af' }} // Formal Blue Background
            className="w-[84px] h-[108px] rounded-lg overflow-hidden border-2 border-slate-300 shadow-sm relative flex items-center justify-center"
          >
            <img
              src={photoUrl}
              alt={student.name}
              className="w-full h-full object-cover object-top"
              crossOrigin="anonymous"
            />
            {/* Stamp overlay corner */}
            <div className="absolute -bottom-2 -right-2 transform -rotate-12 pointer-events-none opacity-80">
              <FoundationSealSvg color="#059669" />
            </div>
          </div>
          <span className="text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
            {student.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
          </span>
        </div>

        {/* Student Data Fields */}
        <div className="flex-1 space-y-1 text-[10px]">
          <div>
            <div className="text-[8px] uppercase font-bold text-slate-400 leading-none">Nama Lengkap</div>
            <div className="text-xs font-black text-slate-900 tracking-tight line-clamp-1">
              {student.name.toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
            <div>
              <div className="text-[7.5px] font-bold text-slate-400 leading-none">NIS / NISN</div>
              <div className="font-mono text-[9px] font-black text-slate-800">
                {student.nis} / <span className="text-blue-700">{student.nisn || student.nis}</span>
              </div>
            </div>

            <div>
              <div className="text-[7.5px] font-bold text-slate-400 leading-none">Kelas & Unit</div>
              <div className="text-[9px] font-bold text-slate-800">
                {schoolClass?.name || 'Reguler'} ({config.level})
              </div>
            </div>

            <div>
              <div className="text-[7.5px] font-bold text-slate-400 leading-none">Tempat, Tgl Lahir</div>
              <div className="text-[8.5px] font-semibold text-slate-700 line-clamp-1">
                {student.birthPlace || 'Jombang'}, {student.birthDate || '12-08-2009'}
              </div>
            </div>

            <div>
              <div className="text-[7.5px] font-bold text-slate-400 leading-none">Masa Berlaku</div>
              <div className="text-[8.5px] font-semibold text-emerald-700">
                Selama Menjadi Santri
              </div>
            </div>
          </div>

          {/* Principal Signature & Seal Box (Pojok Kanan Bawah) */}
          <div className="pt-0.5 flex justify-end items-end relative">
            <div className="text-right text-[7.5px] leading-tight relative pr-1">
              <div className="text-slate-500 font-medium">Jombang, 15 Juli 2026</div>
              <div className="text-[7.5px] font-bold text-slate-700">Kepala {config.unitName}</div>
              
              {/* Overlaid Signature and Seal */}
              <div className="h-8 relative my-0.5 flex justify-end items-center">
                <div className="absolute right-10 -top-2">
                  <FoundationSealSvg color="#047857" />
                </div>
                <div className="relative z-10 flex items-center justify-end">
                  {config.principalSignatureUrl ? (
                    <img
                      src={config.principalSignatureUrl}
                      alt={`TTD ${config.principalName}`}
                      className="h-8 max-w-[100px] object-contain select-none pointer-events-none"
                    />
                  ) : (
                    <PrincipalSignatureSvg color="#1e3a8a" />
                  )}
                </div>
              </div>

              <div className="font-bold text-slate-900 underline text-[8px]">{config.principalName}</div>
              <div className="text-[7px] text-slate-500 font-mono">{config.principalNip}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode NISN: Lebih Jelas & Posisi Berjarak dari Tepi Bawah (Tidak Terlalu Kebawah) */}
      <div className="px-3.5 pb-2.5 pt-1 relative z-10">
        <div className="bg-slate-50 rounded-xl border border-slate-300/90 px-3 py-1.5 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex-1">
            <div
              className="w-full flex items-center justify-center overflow-hidden h-6.5"
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />
            <div className="text-center font-mono text-[9px] font-black tracking-widest text-slate-900 mt-0.5">
              * NISN: {student.nisn || student.nis} *
            </div>
          </div>
          <div className="text-[7px] text-slate-500 font-bold leading-tight border-l border-slate-300 pl-2.5 text-right flex-shrink-0">
            <div className="text-blue-800 font-black">PRESENSI SMART</div>
            <div>RFID & BARCODE</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. SISI BELAKANG KARTU PELAJAR (BACK SIDE)
// Dilengkapi Ruang Kode QR Website Sekolah/Yayasan & Visi-Misi
// ============================================================================
export const StudentCardBack: React.FC<StudentCardProps> = ({
  student,
  schoolName,
  schoolAddress,
  foundationWebsite,
  watermarkUrl,
  config = DEFAULT_LEVEL_CONFIGS['SMA/MA'],
}) => {
  const activeWatermark = config.watermarkUrl || watermarkUrl;
  const targetWebsite = config.websiteUrl || foundationWebsite || 'https://mambaululum.sch.id';
  const cleanWebsiteUrl = targetWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // Auto QR Code generator link or uploaded custom QR
  const qrImageSrc = config.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetWebsite)}&bgcolor=ffffff&color=1e3a8a`;

  return (
    <div
      id={`card-back-${student.id}`}
      style={{
        width: '425px',
        height: '272px',
        backgroundColor: '#ffffff',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
      className="relative rounded-2xl overflow-hidden border-2 border-slate-300 shadow-xl flex flex-col justify-between select-none text-slate-800 p-3.5"
    >
      {/* Dynamic Watermark Background */}
      {activeWatermark ? (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
          <img
            src={activeWatermark}
            alt="Watermark"
            className="w-56 h-56 object-contain opacity-[0.08] select-none pointer-events-none filter grayscale"
          />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none opacity-[0.035] flex items-center justify-center z-0">
          <svg viewBox="0 0 100 100" className="w-64 h-64" fill="currentColor">
            <circle cx="50" cy="50" r="45" />
          </svg>
        </div>
      )}

      {/* Header Back Side */}
      <div className="border-b-2 border-slate-200 pb-1.5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="Logo"
              className="w-6 h-6 object-contain rounded-full bg-white p-0.5 border border-slate-300 flex-shrink-0"
            />
          ) : (
            <SchoolEmblemSvg className="w-6 h-6" />
          )}

          <div>
            <div className="text-[10px] font-black text-slate-900 leading-none">
              {schoolName.toUpperCase()}
            </div>
            <div className="text-[8.5px] font-bold text-blue-700 leading-tight">
              {config.unitName}
            </div>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[7.5px] font-bold bg-slate-100 text-slate-600 border border-slate-300 uppercase">
          VISI, MISI & TATA TERTIB
        </span>
      </div>

      {/* Center Body: Two Columns (Left: Visi/Misi/Ketentuan, Right: QR Code Website) */}
      <div className="py-1 flex items-start gap-3 relative z-10 flex-1">
        {/* Left Column: Visi & Misi & Ketentuan */}
        <div className="flex-1 space-y-1 text-[7.5px] leading-tight">
          <div>
            <span className="font-black text-slate-900 text-[8px] uppercase text-blue-800 block mb-0.5">
              ★ VISI SEKOLAH:
            </span>
            <p className="italic text-slate-700 font-medium pl-1.5 border-l-2 border-blue-500">
              "{config.vision}"
            </p>
          </div>

          <div>
            <span className="font-black text-slate-900 text-[8px] uppercase text-blue-800 block mb-0.5">
              ★ MISI SEKOLAH:
            </span>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-700 pl-0.5">
              {config.missions.map((m, idx) => (
                <li key={idx} className="line-clamp-1">{m}</li>
              ))}
            </ol>
          </div>

          {/* Tata Tertib Kartu */}
          <div className="pt-0.5 border-t border-slate-200">
            <span className="font-black text-slate-900 text-[8px] uppercase text-amber-800 block mb-0.5">
              ★ KETENTUAN KARTU PELAJAR:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[7px]">
              <li>Wajib dibawa setiap hari untuk presensi smart kiosk deteksi barcode & RFID.</li>
              <li>Kartu tidak boleh dipinjamkan atau dialihkan kepada pihak lain.</li>
              <li>Jika kartu hilang/rusak, segera lapor ke bagian Tata Usaha Yayasan.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Dedicated QR Code Box for School/Foundation Website */}
        <div className="w-[104px] flex-shrink-0 flex flex-col items-center justify-center bg-slate-50/90 rounded-xl border border-slate-200 p-2 text-center shadow-2xs">
          <div className="text-[7.5px] font-black text-slate-800 uppercase tracking-tight mb-1">
            KODE QR WEBSITE
          </div>
          
          <div className="w-18 h-18 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs flex items-center justify-center overflow-hidden">
            <img
              src={qrImageSrc}
              alt="QR Website"
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
            />
          </div>

          <div className="mt-1 text-[6.5px] text-blue-800 font-mono font-bold truncate max-w-[95px]" title={targetWebsite}>
            {cleanWebsiteUrl}
          </div>
          <div className="text-[6px] text-slate-400 font-medium">
            Scan untuk Info Resmi
          </div>
        </div>
      </div>

      {/* Footer Contact Info (Address and Website dynamically customized) */}
      <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[7px] text-slate-500 font-medium relative z-10">
        <div className="truncate max-w-[230px]">
          <span>Alamat: {config.schoolAddress || schoolAddress || 'Jl. Pesantren Mambaul Ulum, Diwek, Jombang'}</span>
        </div>
        <div className="text-right">
          <span>Web: {cleanWebsiteUrl} • Telp: (0321) 876543</span>
        </div>
      </div>
    </div>
  );
};
