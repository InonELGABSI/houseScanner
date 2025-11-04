export interface ScanEvents {
  'scan:uploaded': (data: {
    scanId: string;
    roomsCount: number;
    imagesCount: number;
    message: string;
  }) => void;

  'scan:processing': (data: {
    scanId: string;
    message: string;
  }) => void;

  'scan:progress': (data: {
    scanId: string;
    progress: number;
    stage?: string;
  }) => void;

  'scan:completed': (data: {
    scanId: string;
    message: string;
    result?: any;
  }) => void;

  'scan:failed': (data: {
    scanId: string;
    error: string;
  }) => void;
}
