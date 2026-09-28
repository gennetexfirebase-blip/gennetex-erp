import PageHeader from '../components/PageHeader';
import { LegalBody, LegalList, LegalNote, LegalSection } from '../components/LegalContent';
import { APP_INFO } from '../lib/siteUrl';

/** English rendering of the public privacy policy. Keep sections aligned with PrivacyPage. */
export default function PrivacyEnglish({ updatedAt }) {
  return <>
    <PageHeader label="Privacy" title="Privacy Policy" description={`${APP_INFO.name} processes company information only for work purposes and within the permissions you grant.`} />
    <LegalBody updatedAt={updatedAt}>
      <LegalSection index={1} title="Overview">
        <p>{APP_INFO.name} ({APP_INFO.developer}) is an internal company management system. This policy explains what information is processed while you use it and how that information is protected.</p>
        <p>The system is intended only for employees authorized by the organization. Public self-registration is not available.</p>
      </LegalSection>
      <LegalSection index={2} title="Information we process">
        <p>We process the following information required to operate the system:</p>
        <LegalList items={[
          'Account details: employee first and last name, work email, phone number, job title, and department.',
          'Sign-in identifiers: Google or Apple account identifiers, when those sign-in methods are used.',
          'Location: approximate and precise location during working hours for attendance and workplace monitoring.',
          'Biometric data: a face template, only for attendance verification if you choose to enroll.',
          'Images: attendance selfies, fuel receipts, inventory photos, and attachments.',
          'Audio and video: transmitted when you make a call; calls are not recorded by the app.',
          'Messages: in-app chat text and attachments.',
          'Work activity: attendance, tasks, inventory, tools, vehicles, fuel records, and reports.',
          'Technical data: device type, app version, notification identifier, and error logs.',
        ]} />
        <LegalNote><strong>Location may be collected while the app is closed.</strong> This supports uninterrupted attendance records. An explanation is shown before permission is requested. You can decline or revoke permission at any time in your device settings.</LegalNote>
        <LegalNote><strong>Biometric data.</strong> Raw facial images are not retained for face recognition; only an encrypted mathematical template remains. Face enrollment is optional, and you can record attendance without it. The template is deleted when the account is deleted.</LegalNote>
        <LegalNote>Sign-in may use Google, Apple, or an organization-issued email and password. We do not store passwords in plain text; Supabase Auth manages authentication.</LegalNote>
      </LegalSection>
      <LegalSection index={3} title="Location information">
        <p>We use location to record attendance and check workplace geofences. The app uses two types of location:</p>
        <LegalList items={[
          'Foreground location: used when you record attendance to calculate your distance from a work site.',
          'Background location: used to monitor field staff during active shifts, including when the app is closed or not in use. It starts only after a shift begins.',
        ]} />
        <LegalNote>You can revoke location permission in device settings at any time. If you do, you can still request a manual attendance correction.</LegalNote>
      </LegalSection>
      <LegalSection index={4} title="Face recognition (biometric information)">
        <p>Face recognition helps prevent someone else from recording attendance for you. We store a numerical template (embedding) derived from your face, rather than a raw facial image; the original image cannot be reconstructed from the template.</p>
        <LegalNote>Only you and system administrators can access the biometric template. You may decline enrollment and record attendance using QR or location instead.</LegalNote>
      </LegalSection>
      <LegalSection index={5} title="Sign-in and access tokens">
        <p>Access and refresh tokens travel over encrypted HTTPS connections and are stored in protected storage on your device. Tokens are not written to logs or shared with third-party services.</p>
        <LegalList items={[
          'Passwords are not stored in plain text; Supabase Auth manages sign-in.',
          'Expired tokens become invalid automatically.',
          'Tokens stored on the device are removed when you sign out.',
        ]} />
      </LegalSection>
      <LegalSection index={6} title="Sharing with third parties">
        <p>We do not sell company or employee data or share it for advertising. Data is shared only in these circumstances:</p>
        <LegalList items={[
          'Supabase: database, file storage, and authentication. Company data is stored there.',
          'Google Firebase Cloud Messaging: delivery of push notifications, including their titles and short text.',
          'Google Gemini: the in-app AI assistant. Your question and relevant work information are sent only when you ask a question.',
          'OpenStreetMap: map tiles for the visible map area, without sending your location coordinates.',
          'Telegram: delivery of notifications if you choose to connect it.',
          'Authorities: where formally required by law.',
        ]} />
        <p>Each service has its own privacy policy. We do not share data with other third parties. Biometric face templates are not shared with third parties and remain encrypted on our servers.</p>
      </LegalSection>
      <LegalSection index={7} title="Security and access control">
        <LegalList items={[
          'All connections use HTTPS/TLS encryption.',
          'Database row-level security controls access to records.',
          'Users see information according to their role (employee, manager, or administrator) and department.',
          'Administrator actions are logged and monitored.',
        ]} />
      </LegalSection>
      <LegalSection index={8} title="Retention and deletion">
        <p>Work records are retained for the period required by company policy and applicable law. Access is disabled promptly when an employee leaves.</p>
        <LegalList items={[
          'You may request account deletion in the app or by email.',
          'Personal information is deleted within 30 days after a deletion request is received.',
          'Financial and employment records may be retained for periods required by law.',
        ]} />
      </LegalSection>
      <LegalSection index={9} title="Changes to this policy">
        <p>If we change this policy, we will update the date at the top of this page and publish the changes here. Material changes to how information is used will be communicated in the app.</p>
      </LegalSection>
      <LegalSection index={10} title="Contact">
        <p>For privacy questions or data deletion requests, contact:</p>
        <LegalList items={[`Organization: ${APP_INFO.developer}`, `Email: ${APP_INFO.contactEmail}`, 'Address: Ulaanbaatar, Mongolia']} />
      </LegalSection>
    </LegalBody>
  </>;
}
