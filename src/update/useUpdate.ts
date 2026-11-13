import { useContext } from 'react';
import { UpdateContext, type UpdateState } from './updateContext';

export function useUpdate(): UpdateState {
  const value = useContext(UpdateContext);
  if (!value) throw new Error('useUpdate は UpdateProvider の中で使ってください');
  return value;
}
