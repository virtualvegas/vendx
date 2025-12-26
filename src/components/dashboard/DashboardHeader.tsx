import { User } from "@supabase/supabase-js";

interface DashboardHeaderProps {
  user: User;
}

const DashboardHeader = ({ user }: DashboardHeaderProps) => {
  return (
    <header className="bg-card border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
      <div className="min-w-0">
        <h1 className="text-xl lg:text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
      </div>
    </header>
  );
};

export default DashboardHeader;
