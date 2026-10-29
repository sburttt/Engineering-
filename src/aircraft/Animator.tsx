import { useFrame } from '@react-three/fiber';
import { useStore } from '../state/store';
import { anim } from './runtime';

const DEG = Math.PI / 180;

/** Eases animated values toward the store targets (explode, control surfaces, bay doors). */
export function Animator() {
  useFrame((_, dt) => {
    const s = useStore.getState();
    const k = 1 - Math.exp(-dt * 6);
    anim.explode += (s.explode - anim.explode) * k;
    anim.pitch += (s.pitch * DEG - anim.pitch) * k;
    anim.roll += (s.roll * DEG - anim.roll) * k;
    anim.bay += ((s.bayOpen ? 1 : 0) - anim.bay) * (1 - Math.exp(-dt * 3));
  });
  return null;
}
