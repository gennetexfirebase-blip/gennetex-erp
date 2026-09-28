import PageHeader from '../components/PageHeader';
import { LegalBody, LegalList, LegalNote, LegalSection } from '../components/LegalContent';
import { APP_INFO } from '../lib/siteUrl';

const CONTACT = APP_INFO.contactEmail;
const REQUEST_EMAIL = `mailto:${CONTACT}?subject=${encodeURIComponent('Gennetex ERP — Account deletion request')}&body=${encodeURIComponent('Hello,\n\nI request deletion of my Gennetex ERP account and associated personal data.\n\nRegistered email:\nFull name:\nOrganization:\n\nThank you.')}`;

export default function DeleteAccountEnglish({ updatedAt }) {
  return <>
    <PageHeader label="Data" title="Delete your account and data" description={`Every ${APP_INFO.name} user may request deletion of their account and personal data.`} />
    <LegalBody updatedAt={updatedAt}>
      <LegalNote>
        <p>You can request account deletion without signing in to the app.</p>
        <a href={REQUEST_EMAIL} className="action-primary mt-4">Prepare deletion request email</a>
        <p className="mt-3">The button opens your email app. Complete the details and send the message yourself.</p>
        <p className="mt-2 break-words">If it does not open, send your request to {CONTACT} using the instructions below.</p>
      </LegalNote>
      <LegalSection index={1} title="Delete from the app (fastest)">
        <p>Open Gennetex ERP on your phone:</p>
        <LegalList items={['Open Profile → Privacy & Data.', 'Tap Delete Account.', 'Optionally enter a reason and confirm.']} />
        <p>Your sign-in access is disabled immediately, and location sharing and notifications stop. Remaining personal data is deleted within 30 days.</p>
      </LegalSection>
      <LegalSection index={2} title="No app? Request deletion by email">
        <p>If you lost your phone or removed the app, email:</p>
        <LegalNote><p className="font-medium text-graphite-100">{CONTACT}</p><p className="mt-2">Subject: <span className="text-graphite-100">Account deletion request</span></p><p className="mt-1">Include your registered email, full name, and the name of the organization where you worked.</p></LegalNote>
        <p>We acknowledge requests within three business days, verify your identity by contacting your registered address, and then delete the account. We will email you when deletion is complete.</p>
      </LegalSection>
      <LegalSection index={3} title="What is deleted"><LegalList items={[
        'Sign-in access (disabled immediately).',
        'Location records (GPS history).',
        'Face-recognition template (biometric embedding) and attendance photos.',
        'Device tokens used for notifications.',
        'Profile information: name, email, phone, job title, and photo.',
        'Chat messages you sent.',
      ]} /></LegalSection>
      <LegalSection index={4} title="What may be retained, and why"><p>Some employment-related records must be kept for periods required by Mongolian labor and accounting law. We archive them without linking them to your personal information:</p><LegalList items={[
        'Attendance and hours-worked summaries.',
        'Payroll and accounting records.',
        'Inventory transactions connected to material responsibility.',
      ]} /><p>These records are deleted when the legal retention period ends.</p></LegalSection>
      <LegalSection index={5} title="More information"><p>Read the <a className="text-graphite-100 underline underline-offset-4" href="/privacy">Privacy Policy</a> for details about how we process information. Contact {CONTACT} with questions.</p></LegalSection>
    </LegalBody>
  </>;
}
