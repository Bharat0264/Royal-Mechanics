export type AppRole = 'CUSTOMER' | 'ADMIN' | 'MECHANIC';

/**
 * The single routing boundary for authenticated roles. If portals move to
 * subdomains later, update this map without touching authentication or UI code.
 */
export function roleHomePath(role?: AppRole | null) {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'MECHANIC':
      return '/mechanic';
    case 'CUSTOMER':
    default:
      return '/';
  }
}
