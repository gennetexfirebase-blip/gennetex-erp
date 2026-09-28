import PageHeader from '../components/PageHeader';
import { LegalBody, LegalList, LegalNote, LegalSection } from '../components/LegalContent';
import { APP_INFO } from '../lib/siteUrl';

const CONTACT = APP_INFO.contactEmail;

export default function SupportEnglish({ updatedAt }) {
  return <>
    <PageHeader label="Support" title="Help and support" description={`If you have trouble using ${APP_INFO.name}, check the guidance below or contact us directly.`} />
    <LegalBody updatedAt={updatedAt}>
      <LegalSection index={1} title="Contact us">
        <p>Send technical questions, feedback, or data requests to:</p>
        <LegalList items={[`Email: ${CONTACT}`, 'Response time: within 24 hours on business days', 'In the app: Profile → Message the developer']} />
        <LegalNote>For attendance, pay, or shift issues, contact your organization’s administrator first. Your organization controls those records.</LegalNote>
      </LegalSection>
      <LegalSection index={2} title="Attendance is not recording">
        <p>Common causes:</p>
        <LegalList items={[
          'Location permission is off. Open Settings → Gennetex ERP → Location and allow location while using the app.',
          'You are outside the work-site geofence. Choose remote check-in and wait for administrator approval.',
          'Face verification failed. Try again in better light with your face fully visible; QR or location check-in becomes available after the third attempt.',
          'You missed check-in. Submit an attendance correction request from the Attendance screen.',
        ]} />
      </LegalSection>
      <LegalSection index={3} title="Notifications are missing"><LegalList items={[
        'Check notification permission in Settings → Gennetex ERP → Notifications.',
        'Check battery-saving restrictions. Some devices, including Xiaomi, Huawei, and Oppo, limit background activity; set Gennetex ERP to unrestricted.',
        'Open Profile → Notification diagnostics in the app to find the failing step.',
      ]} /></LegalSection>
      <LegalSection index={4} title="Cannot sign in">
        <p>Gennetex ERP is an <strong>internal company system</strong>. Only employees approved in advance by an administrator can sign in. Self-registration is unavailable.</p>
        <LegalList items={[
          'Ask your organization’s administrator to add your account.',
          'Use the same email address the administrator registered.',
          'A new phone may require administrator approval.',
        ]} />
      </LegalSection>
      <LegalSection index={5} title="Data and privacy"><p>Read our <a href="/privacy">Privacy Policy</a> for details about data use. To remove your account, follow the <a href="/delete-account">Delete Account</a> instructions.</p></LegalSection>
    </LegalBody>
  </>;
}
