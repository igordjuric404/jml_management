import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatWidget } from "@/components/chat-widget";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { getServerSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const user = session
    ? { full_name: session.full_name, user: session.user }
    : { full_name: "Administrator", user: "Administrator" };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
      <ChatWidget />
      <ConfirmDialog />
    </div>
  );
}
