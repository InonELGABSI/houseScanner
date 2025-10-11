import { useScan } from '../../context/ScanContext';
import { StartScanPage } from './StartScanPage';
import { AddRoomsImagesPage } from './AddRoomsImagesPage';
import { VerifyImagesPage } from './VerifyImagesPage';
import { ProcessingPage } from './ProcessingPage';
import { ScanSummaryStep } from './ScanSummaryStep';

export function ScanPage() {
  const { state } = useScan();

  switch (state.phase) {
    case 'idle':
      return <StartScanPage />;
    case 'capture':
      return <AddRoomsImagesPage />;
    case 'verify':
      return <VerifyImagesPage />;
    case 'processing':
      return <ProcessingPage />;
    case 'summary':
      return <ScanSummaryStep />;
    default:
      return <StartScanPage />;
  }
}