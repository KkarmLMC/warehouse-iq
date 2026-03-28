/**
 * useRole — thin wrapper around useAuth for backwards compatibility.
 * All components that import useRole continue to work unchanged.
 */
export { default, useAuth } from './useAuth.jsx'
export { useAuth as getRole } from './useAuth.jsx'
