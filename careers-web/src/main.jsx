import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SiteContentProvider } from '../../public-web/src/context/SiteContentContext';
import CareersPage from '../../public-web/src/pages/CareersPage';
import CareersLayout from './CareersLayout';
import '../../public-web/src/index.css';

/**
 * cv.gennetex.com — "ажилд орох" хэсэг өөрийн домэйн дээр.
 *
 * Хуудас, маягт, загвар нь `public-web/`-тэй НЭГ эх сурвалжтай тул
 * хоёр газар засах шаардлагагүй. Ажлын байрны жагсаалт нь
 * `careers.jobOptions` агуулгаас ирдэг — админаас засна.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SiteContentProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<CareersLayout />}>
            <Route path="/" element={<CareersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SiteContentProvider>
  </StrictMode>,
);
