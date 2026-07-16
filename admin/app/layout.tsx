import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'SocialConnect Operations', description: 'Finance, trust and platform operations' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
