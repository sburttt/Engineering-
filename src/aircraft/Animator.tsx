import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import { anim } from './runtime';

const DEG = Math.PI / 180;
const ASM_SECONDS = 1.15;

/** Eases animated values toward the store targets (explode, control surfaces, bay doors, assemblies). */
export function Animator() {
  useFrame((_, dt) => {
    const s = useStore.getState();
    const k = 1 - Math.exp(-dt * 6);
    anim.explode += (s.explode - anim.explode) * k;
    anim.pitch += (s.pitch * DEG - anim.pitch) * k;
    anim.roll += (s.roll * DEG - anim.roll) * k;
    anim.bay += ((s.bayOpen ? 1 : 0) - anim.bay) * (1 - Math.exp(-dt * 3));
    // Assembly separation: a timed, eased move. Switching assemblies first closes the shown one.
    // wall-clock pacing (capped only against long stalls), so slow devices finish on time
    const step = Math.min(dt, 0.5) / ASM_SECONDS;
    if (anim.asmShown !== s.explodeAsm) {
      if (anim.asmShown && anim.asmT > 0) anim.asmT = Math.max(0, anim.asmT - step * 1.6);
      else {
        anim.asmShown = s.explodeAsm;
        anim.asmT = 0;
      }
    } else if (anim.asmShown) anim.asmT = Math.min(1, anim.asmT + step);
  });
  return null;
}
