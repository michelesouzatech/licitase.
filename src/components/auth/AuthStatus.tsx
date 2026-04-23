import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthGate";

export function AuthStatus() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right md:block">
        <p className="text-xs font-semibold text-primary-foreground">Conectada</p>
        <p className="max-w-52 truncate text-xs text-primary-foreground/70">{user?.email}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={signOut} className="shrink-0">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
}
