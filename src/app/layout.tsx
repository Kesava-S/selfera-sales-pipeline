import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, Users, PlusCircle, Mail, Settings } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sales Pipeline Dashboard",
  description: "Manage sales pipeline and automated follow-ups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-logo mb-6">
              <div className="sidebar-logo-icon">
                <Users size={18} color="white" />
              </div>
              Selfera Sales
            </div>
            <nav className="sidebar-nav">
              <Link href="/" className="nav-item">
                <LayoutDashboard size={20} />
                Today Tasks
              </Link>
              <Link href="/leads" className="nav-item">
                <Users size={20} />
                All Leads
              </Link>
              <Link href="/leads/add" className="nav-item">
                <PlusCircle size={20} />
                Add Lead
              </Link>
              <Link href="/templates" className="nav-item">
                <Mail size={20} />
                Templates
              </Link>
            </nav>
            <div className="mt-auto">
              <Link href="/settings" className="nav-item">
                <Settings size={20} />
                Settings
              </Link>
            </div>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
