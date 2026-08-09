export type SkillLevel = 'Сайн' | 'Дунд' | 'Муу' | '';

export interface GeneralInfo {
  clanName: string;
  fatherName: string;
  firstName: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthProvince: string;
  birthDistrict: string;
  ethnicity: string;
  gender: 'Эрэгтэй' | 'Эмэгтэй' | '';
  registrationNo: string;
  email: string;
  paysSocialInsurance: 'Тийм' | 'Үгүй' | '';
  phoneMobile: string;
  phoneHome: string;
  driverLicenseNo: string;
  driverLicenseClass: string;
  bloodType: string;
  address: string;
  housingType: 'Өөрийн' | 'Түрээсийн' | 'Эцэг эх хамаатан садангийн' | '';
  bodySize: string;
  clothingSize: string;
  shoeSize: string;
  univisionContractNo: string;
  photoDataUrl: string;
}

export interface FamilyMember {
  fullName: string;
  relation: string;
  birthYear: string;
  workOrSchool: string;
  phone: string;
}

export interface EducationRow {
  location: string;
  schoolName: string;
  enteredYear: string;
  graduatedYear: string;
  profession: string;
  degree: string;
  gpa: string;
}

export interface WorkExperienceRow {
  companyName: string;
  duties: string;
  position: string;
  startDate: string;
  endDate: string;
  salary: string;
  leaveReason: string;
}

export interface LanguageRow {
  language: string;
  listening: SkillLevel;
  speaking: SkillLevel;
  reading: SkillLevel;
  writing: SkillLevel;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface JobApplicationFormData {
  company: string;
  title: string;
  general: GeneralInfo;
  family: {
    married: 'Тийм' | 'Үгүй' | '';
    members: FamilyMember[];
  };
  education: EducationRow[];
  workExperience: WorkExperienceRow[];
  languages: LanguageRow[];
  personal: {
    strengths: string;
    weaknesses: string;
  };
  jobInterest: {
    position: string;
    desiredSalary: string;
  };
  emergencyContacts: EmergencyContact[];
  consent: boolean;
  signatureSvg: string;
  signedAt: string;
}

export const emptyGeneral = (): GeneralInfo => ({
  clanName: '',
  fatherName: '',
  firstName: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  birthProvince: '',
  birthDistrict: '',
  ethnicity: '',
  gender: '',
  registrationNo: '',
  email: '',
  paysSocialInsurance: '',
  phoneMobile: '',
  phoneHome: '',
  driverLicenseNo: '',
  driverLicenseClass: '',
  bloodType: '',
  address: '',
  housingType: '',
  bodySize: '',
  clothingSize: '',
  shoeSize: '',
  univisionContractNo: '',
  photoDataUrl: '',
});

export const emptyForm = (): JobApplicationFormData => ({
  company: 'ЖЕННЕТЕКС ХХК',
  title: 'Ажилд орохыг хүсэгчийн анкет',
  general: emptyGeneral(),
  family: { married: '', members: [{ fullName: '', relation: '', birthYear: '', workOrSchool: '', phone: '' }] },
  education: [{ location: '', schoolName: '', enteredYear: '', graduatedYear: '', profession: '', degree: '', gpa: '' }],
  workExperience: [{ companyName: '', duties: '', position: '', startDate: '', endDate: '', salary: '', leaveReason: '' }],
  languages: [{ language: '', listening: '', speaking: '', reading: '', writing: '' }],
  personal: { strengths: '', weaknesses: '' },
  jobInterest: { position: '', desiredSalary: '' },
  emergencyContacts: [
    { name: '', relation: '', phone: '' },
    { name: '', relation: '', phone: '' },
  ],
  consent: false,
  signatureSvg: '',
  signedAt: '',
});
