import { AuthProvider } from '@/features/auth/auth-provider';

/**
 * Layout da área administrativa.
 *
 * Sem navbar e sem rodapé do site público — é outro produto, para outro usuário,
 * com outra hierarquia visual. Foi para isso que separamos em route groups.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
