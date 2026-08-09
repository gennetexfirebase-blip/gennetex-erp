import PageHeader from '../components/PageHeader';
import ProjectsSection from '../components/ProjectsSection';

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        label="Төслүүд"
        title="Хэрэгжүүлсэн ажлууд"
        description="Олон салбарын харилцагчдад амжилттай хэрэгжүүлсэн төслүүдээс сонголт."
      />
      <ProjectsSection embedded />
    </>
  );
}
