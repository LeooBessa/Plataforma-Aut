import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';

/**
 * Layout do site público.
 *
 * Um *route group* — o `(public)` entre parênteses não aparece na URL. Ele
 * existe para que a área administrativa possa ter um layout completamente
 * diferente (sem esta navbar, sem este rodapé) sem que as duas se misturem.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
