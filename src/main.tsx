import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as Window & { __MSD_MOUNTED__?: boolean }).__MSD_MOUNTED__ = true;
createRoot(document.getElementById('root')!).render(<App />);
