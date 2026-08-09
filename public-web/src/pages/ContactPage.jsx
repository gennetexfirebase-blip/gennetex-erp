import PageHeader from '../components/PageHeader';
import ContactSection from '../components/ContactSection';

export default function ContactPage() {
  return (
    <>
      <PageHeader
        label="Холбоо барих"
        title="Бидэнтэй холбогдоорой"
        description="Төслийн зөвлөгөө, үнийн санал эсвэл техникийн дэмжлэг авахыг хүсвэл бидэнтэй холбогдоно уу."
      />
      <ContactSection embedded />
    </>
  );
}
