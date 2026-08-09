import PageHeader from '../components/PageHeader';
import AboutSection from '../components/AboutSection';

export default function AboutPage() {
  return (
    <>
      <PageHeader
        label="Бидний тухай"
        title="Найдвартай технологийн түнш"
        description="Бид орчин үеийн технологи, туршлагатай инженерүүдийн багаараа дамжуулан байгууллагуудын IT дэд бүтцийг бүтээдэг."
      />
      <AboutSection embedded />
    </>
  );
}
