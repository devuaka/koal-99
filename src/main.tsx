import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/boot.css';
import './styles/apps.css';
import './styles/kos.css';
import { registerAll } from './apps';
import { App } from './App';

registerAll();
createRoot(document.getElementById('root')!).render(<App />);
