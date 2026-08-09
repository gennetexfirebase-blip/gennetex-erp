import PageHeader from '../components/PageHeader';
import ServicesSection from '../components/ServicesSection';

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        label="Үйлчилгээ"
        title="Мэргэжлийн IT шийдэл"
        description="Сүлжээ, шилэн кабель, аюулгүй байдал, сервер өрөө — бүгд нэг дор."
      />
      <ServicesSection embedded />
    </>
  );
}
