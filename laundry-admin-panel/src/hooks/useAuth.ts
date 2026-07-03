import { useSelector } from 'react-redux';
import type { RootState } from '../app/store';

export const useAuth = () => useSelector((state: RootState) => state.auth);

export const usePermission = (...roles: string[]) => {
  const { user } = useSelector((state: RootState) => state.auth);
  if (!user) return false;
  return roles.includes(user.role);
};
