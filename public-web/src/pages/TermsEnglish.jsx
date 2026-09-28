import PageHeader from '../components/PageHeader';
import { LegalBody, LegalList, LegalNote, LegalSection } from '../components/LegalContent';
import { APP_INFO } from '../lib/siteUrl';

export default function TermsEnglish({ updatedAt }) {
  return <>
    <PageHeader label="Terms" title="Terms of Service" description={`By using ${APP_INFO.name}, you agree to the terms below.`} />
    <LegalBody updatedAt={updatedAt}>
      <LegalSection index={1} title="Scope"><p>{APP_INFO.name} is an internal management system operated by {APP_INFO.developer} and is intended only for users authorized by the organization. There is no public registration; an administrator must approve access.</p></LegalSection>
      <LegalSection index={2} title="Accounts and sign-in"><LegalList items={[
        'Do not share your sign-in credentials (Google, Apple, or an organization-issued account).',
        'Do not let multiple people use the same account.',
        'Report lost credentials or unauthorized access to an administrator immediately.',
        'You are responsible for activity performed through your account.',
      ]} /></LegalSection>
      <LegalSection index={3} title="In-app work communications"><p>When using the app’s chat, calls, and work information:</p><LegalList items={[
        'Follow your organization’s internal and information-security policies.',
        'Use these functions only for work purposes.',
        'Do not copy or disclose communications without authorization.',
        'Access ends when an administrator revokes your account.',
      ]} /></LegalSection>
      <LegalSection index={4} title="Company information"><p>Employee, customer, and operational information in the system belongs to the organization and is confidential.</p><LegalList items={[
        'Do not copy, disclose, or transfer information to third parties without authorization.',
        'Do not use screenshots or exported files for non-work purposes.',
        'Do not use company information after leaving the organization.',
      ]} /></LegalSection>
      <LegalSection index={5} title="Prohibited activities"><LegalList items={[
        'Accessing the system without authorization or attempting actions beyond your permissions.',
        'Bypassing security controls or reverse engineering the application.',
        'Disrupting the system through automated requests or excessive load.',
        'Submitting false or misleading attendance, report, or inventory information.',
        'Uploading malicious software or files.',
      ]} /><LegalNote>Violations may result in immediate account suspension and action under company rules and applicable law.</LegalNote></LegalSection>
      <LegalSection index={6} title="Administrator responsibilities"><LegalList items={[
        'Adding, granting access to, and deactivating users within their assigned authority.',
        'Managing department and team structures within their permissions.',
        'Monitoring system logs and activity.',
        'Protecting data privacy and security.',
      ]} /></LegalSection>
      <LegalSection index={7} title="User responsibilities"><LegalList items={[
        'Enter accurate work information on time.',
        'Access your own profile and authorized department information.',
        'Request correction or deletion of your personal information.',
        'Report system problems to an administrator.',
      ]} /></LegalSection>
      <LegalSection index={8} title="Service availability"><p>We aim to keep the system available, but maintenance, updates, cloud-service outages, or network failures may interrupt it. We are not liable for indirect losses caused by such interruptions.</p></LegalSection>
      <LegalSection index={9} title="Security"><LegalList items={[
        'All connections use HTTPS/TLS encryption.',
        'Access is restricted by role and department.',
        'Passwords are not stored in plain text; Supabase Auth manages sign-in.',
        'Important actions are logged.',
      ]} /></LegalSection>
      <LegalSection index={10} title="Changes to these terms"><p>Changes will be published here with an updated date. Continuing to use the system after a change is published means you accept the revised terms.</p></LegalSection>
      <LegalSection index={11} title="Contact"><LegalList items={[`Organization: ${APP_INFO.developer}`, `Email: ${APP_INFO.contactEmail}`, 'Address: Ulaanbaatar, Mongolia']} /></LegalSection>
    </LegalBody>
  </>;
}
