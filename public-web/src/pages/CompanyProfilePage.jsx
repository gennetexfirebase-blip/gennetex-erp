import { Navigate } from 'react-router-dom';

// Existing bookmarks lead to the introduction on the home page.
export default function CompanyProfilePage() {
  return <Navigate to="/#introduction" replace />;
}
