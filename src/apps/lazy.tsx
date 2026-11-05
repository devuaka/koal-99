// The big 3D games (and Three.js with them) load only when first opened.
import { ComponentType, lazy, Suspense } from 'react';
import type { WinCtx } from '../core/registry';

type AppComp = ComponentType<{ win: WinCtx }>;
function lazyApp(load: () => Promise<AppComp>): AppComp {
  const L = lazy(() => load().then((c) => ({ default: c })));
  return function LazyApp({ win }) {
    return (
      <Suspense fallback={<div className="kp-loading"><span className="spinner dark" /> Loading...</div>}>
        <L win={win} />
      </Suspense>
    );
  };
}

export const Backrooms = lazyApp(() => import('./three/Backrooms').then((m) => m.Backrooms));
export const BlockRun = lazyApp(() => import('./three/blockrun/BlockRun').then((m) => m.BlockRun));
export const Arena = lazyApp(() => import('./three/arena/Arena').then((m) => m.Arena));
export const ArenaMapEditor = lazyApp(() => import('./three/arena/MapEditor').then((m) => m.ArenaMapEditor));
const PlatformerLazy = lazy(() => import('./three/Platformer').then((m) => ({ default: m.Platformer })));
export function Platformer() {
  return (
    <Suspense fallback={<div className="kp-loading"><span className="spinner dark" /> Loading...</div>}>
      <PlatformerLazy />
    </Suspense>
  );
}
